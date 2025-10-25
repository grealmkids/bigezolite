import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SchoolService } from '../../services/school.service';
import { ClassCategorizationService, SchoolType } from '../../services/class-categorization.service';
import { debounceTime, distinctUntilChanged, take } from 'rxjs/operators';
import { CommunicationService } from '../../services/communication.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-communications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './communications.component.html',
  styleUrls: ['./communications.component.scss']
})
export class CommunicationsComponent implements OnInit {
  message = '';
  characterCount = 0;
  smsCreditsConsumed = 1;
  recipientFilter = 'All Students';
  classes: string[] = [];
  isSending = false;

  constructor(
    private schoolService: SchoolService,
    private classCategorizationService: ClassCategorizationService,
    public communicationService: CommunicationService,
    private snack: MatSnackBar
  ) { }

   ngOnInit(): void {
     // Populate classes dropdown based on localStorage schoolType only
     try {
       const schoolType = this.schoolService.getSelectedSchoolType();
       if (schoolType) {
         this.classes = this.classCategorizationService.getClassesForSchoolType(schoolType);
       } else {
         this.classes = [];
       }
     } catch (err) {
       this.classes = [];
     }
  }

  onMessageChange(message: string): void {
    this.message = message;
    this.characterCount = message.length;
    this.smsCreditsConsumed = Math.ceil(message.length / 160);
  }

  sendBulkSms(): void {
    if (!this.message) return;
    this.isSending = true;
    console.log('[BulkSMS][payload]', { recipientFilter: this.recipientFilter, message: this.message });
    this.communicationService.sendBulkSms(this.recipientFilter, this.message).subscribe({
      next: (resp: any) => {
        this.isSending = false;
        console.log('[BulkSMS][response]', resp);
        const sent = resp?.sentCount ?? 0;
        const failed = resp?.failedCount ?? 0;
        this.snack.open(`Sent ${sent} SMS${failed ? `, ${failed} failed` : ''}.`, 'Close', { duration: 4000, panelClass: ['success-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' });
        this.message = '';
        this.recipientFilter = 'All Students';
        this.communicationService.fetchSmsCreditBalance();
      },
      error: (err) => {
        this.isSending = false;
        console.error('[BulkSMS][error]', err);
        this.snack.open(err?.error?.message || 'Failed to send bulk SMS', 'Close', { duration: 4000, panelClass: ['error-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' });
      }
    });
  }
}