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
      <h2 class="welcome-admin" style="color: #0f172a;">Welcome Admin</h2>
      <p class="manage-message" style="color: #2563eb; font-weight:700;">Manage your school data</p>
      <div class="credentials-section">
        <h3>SMS Provider Credentials</h3>
        <p class="section-sub">Only administrators can update provider credentials used to send school SMS.</p>
        <ng-container *ngIf="isAdmin; else notAdmin">
          <form (ngSubmit)="saveCredentials()" class="credentials-form">
            <div class="row">
              <label for="smsUsername">Username</label>
              <input id="smsUsername" type="text" [(ngModel)]="smsUsername" name="smsUsername" />
            </div>

            <div class="row">
              <label for="smsPassword">Password</label>
              <input id="smsPassword" type="password" [(ngModel)]="smsPassword" name="smsPassword" />
            </div>

            <div class="row">
              <label for="smsProvider">Provider (optional)</label>
              <input id="smsProvider" type="text" [(ngModel)]="smsProvider" name="smsProvider" />
            </div>

            <div class="actions">
              <button type="submit" class="btn primary">Save SMS Credentials</button>
              <button type="button" class="btn secondary" (click)="checkBalance()">Check Balance</button>
            </div>
          </form>
        </ng-container>
        <ng-template #notAdmin>
          <p class="muted">You do not have permission to manage SMS credentials.</p>
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
      this.snack.open('School updated', undefined, { duration: 2500 });
    });
  }

  onDelete(): void {
    if (!this.school) return;
    if (!confirm('Are you sure you want to delete this school? This action cannot be undone.')) return;
    this.schoolService.deleteMySchool(this.school.school_id).subscribe(() => {
      this.snack.open('School deleted', undefined, { duration: 2500 });
      this.router.navigate(['/dashboard']);
    });
  }

  saveCredentials(): void {
    if (!this.smsUsername || !this.smsPassword) {
      this.snack.open('Please provide username and password', undefined, { duration: 3000 });
      return;
    }
    // call communication service
    // lazy import to avoid circular deps
    this.communicationService.setSmsCredentials(this.smsUsername, this.smsPassword, this.smsProvider).subscribe({
      next: () => this.snack.open('Credentials saved', undefined, { duration: 2500 }),
      error: (err: any) => this.snack.open(err?.error?.message || 'Failed to save credentials', 'Dismiss', { duration: 4000 })
    });
  }

  checkBalance(): void {
    // trigger fetch and show result
    this.communicationService.fetchSmsCreditBalance();
    // subscribe to latest value and show a snackbar when we receive it
    this.communicationService.smsCreditBalance$.pipe(take(1)).subscribe(bal => {
      this.snack.open(`SMS Balance: ${bal}`, undefined, { duration: 3000 });
    });
  }
}
