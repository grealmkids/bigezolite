import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SchoolService, School } from '../../services/school.service';
import { CommunicationService } from '../../services/communication.service';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-manage-school',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatSnackBarModule],
  template: `
    <div class="manage-school card">
      <h2 class="welcometext" >Welcome</h2>
     
      <div class="credentials-section">
        <div class="credentials-card">
          <div class="card-header">
           
           
          </div>
          <ng-container *ngIf="isAdmin; else notAdmin">
             <h3>SMS Provider Credentials</h3>
            <form (ngSubmit)="saveCredentials()" class="credentials-form">
            <div class="row floating">
              <input id="smsUsername" type="text" placeholder=" " [(ngModel)]="smsUsername" name="smsUsername" />
              <label for="smsUsername">Username</label>
            </div>

            <div class="row floating">
              <input id="smsPassword" type="password" placeholder=" " [(ngModel)]="smsPassword" name="smsPassword" />
              <label for="smsPassword">Password</label>
            </div>

            <div class="row floating">
              <input id="smsProvider" type="text" placeholder=" " [(ngModel)]="smsProvider" name="smsProvider" />
              <label for="smsProvider">Provider (optional)</label>
            </div>

            <div class="actions">
              <button type="submit" class="btn primary">Save SMS Credentials</button>
              <button type="button" class="btn secondary" (click)="checkBalance()">Check Balance</button>
            </div>
            </form>
          </ng-container>
        <ng-template #notAdmin>
          
        </ng-template>
      </div>
    </div>
  `
})
export class ManageSchoolComponent implements OnInit {
  school: School | null = null;
  schoolForm: any;
  smsUsername = '';
  smsPassword = '';
  smsProvider = 'egosms';
  isAdmin = false;
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);

  constructor(private schoolService: SchoolService, private fb: FormBuilder, private router: Router, private communicationService: CommunicationService) {
    this.schoolForm = this.fb.group({
      school_name: [''],
      admin_phone: [''],
      location_district: [''],
      student_count_range: [''],
      school_type: ['']
    });
  }

  ngOnInit(): void {
    this.schoolService.getMySchool().subscribe(s => {
      this.school = s;
      if (s) this.schoolForm.patchValue({
        school_name: s.school_name || '',
        admin_phone: s.admin_phone || '',
        location_district: s.location_district || '',
        student_count_range: s.student_count_range || '',
        school_type: s.school_type || ''
      });
    });
    // fetch current user info once to determine admin privileges and prefill credentials if admin
    this.http.get(`${(window as any)['env']?.apiUrl || 'http://localhost:3000/api/v1'}/users/me`).subscribe({
      next: (resp: any) => {
        this.isAdmin = !!resp?.isAdmin;
        if (this.isAdmin) {
          this.communicationService.getSmsCredentials().subscribe({
            next: (c: any) => {
              if (c?.username) this.smsUsername = c.username;
              if (c?.password) this.smsPassword = c.password;
              if (c?.provider) this.smsProvider = c.provider;
            },
            error: () => {
              // ignore
            }
          });
        }
      },
      error: () => {
        // ignore: if unauthenticated, isAdmin remains false
        this.isAdmin = false;
      }
    });
  }

  onSave(): void {
    if (!this.school) return;
    const updates = this.schoolForm.value;
    this.schoolService.updateMySchool(this.school.school_id, updates).subscribe(() => {
      this.snack.open('School updated successfully!', 'Close', { 
        duration: 3000,
        panelClass: ['success-snackbar'],
        verticalPosition: 'top',
        horizontalPosition: 'center'
      });
    });
  }

  onDelete(): void {
    if (!this.school) return;
    if (!confirm('Are you sure you want to delete this school? This action cannot be undone.')) return;
    this.schoolService.deleteMySchool(this.school.school_id).subscribe(() => {
      this.snack.open('School deleted successfully!', 'Close', { 
        duration: 3000,
        panelClass: ['success-snackbar'],
        verticalPosition: 'top',
        horizontalPosition: 'center'
      });
      this.router.navigate(['/dashboard']);
    });
  }

  saveCredentials(): void {
    if (!this.smsUsername || !this.smsPassword) {
      this.snack.open('Please provide username and password', 'Close', { 
        duration: 3000,
        panelClass: ['error-snackbar'],
        verticalPosition: 'top',
        horizontalPosition: 'center'
      });
      return;
    }
    // call communication service
    // lazy import to avoid circular deps
    this.communicationService.setSmsCredentials(this.smsUsername, this.smsPassword, this.smsProvider).subscribe({
      next: () => this.snack.open('Credentials saved successfully!', 'Close', { 
        duration: 3000,
        panelClass: ['success-snackbar'],
        verticalPosition: 'top',
        horizontalPosition: 'center'
      }),
      error: (err: any) => this.snack.open(err?.error?.message || 'Failed to save credentials', 'Close', { 
        duration: 4000,
        panelClass: ['error-snackbar'],
        verticalPosition: 'top',
        horizontalPosition: 'center'
      })
    });
  }

  checkBalance(): void {
    // trigger fetch and show result
    this.communicationService.fetchSmsCreditBalance();
    // subscribe to latest value and show a snackbar when we receive it
    this.communicationService.smsCreditBalance$.pipe(take(1)).subscribe(bal => {
      // format number with thousands separators
      const formatted = (typeof bal === 'number') ? bal.toLocaleString() : String(bal);
      // open a persistent snackbar at the top with a green brand style; user must click Close
      this.snack.open(`SMS Balance: ${formatted}`, 'Close', {
        duration: 5000,
        verticalPosition: 'top',
        horizontalPosition: 'center',
        panelClass: ['success-snackbar']
      });
    });
  }
}
