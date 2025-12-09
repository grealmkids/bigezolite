import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SchoolService } from '../../services/school.service';
import { ClassCategorizationService, SchoolType } from '../../services/class-categorization.service';
import { debounceTime, distinctUntilChanged, take } from 'rxjs/operators';
import { CommunicationService } from '../../services/communication.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

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
  isPreview = false;
  preview: { recipientCount: number; estimatedCost: number; currentBalance: number } | null = null;

  constructor(
    private schoolService: SchoolService,
    private classCategorizationService: ClassCategorizationService,
    public communicationService: CommunicationService,
    private snack: MatSnackBar,
    public router: Router
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

  calculate(): void {
    this.isPreview = false; this.preview = null;
    console.log('[BulkSMS][calc][payload]', { recipientFilter: this.recipientFilter });
    this.communicationService.previewBulkSms(this.recipientFilter).subscribe({
      next: (resp: any) => {
        console.log('[BulkSMS][calc][response]', resp);
        this.preview = { recipientCount: resp?.recipientCount || 0, estimatedCost: resp?.estimatedCost || 0, currentBalance: resp?.currentBalance || 0 };
        this.isPreview = true;
        this.communicationService.fetchSmsCreditBalance();
      },
      error: (err: any) => {
        console.error('[BulkSMS][calc][error]', err);
        this.snack.open(err?.error?.message || 'Failed to calculate bulk SMS', 'Close', { duration: 4000, panelClass: ['error-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' });
      }
    });
  }

  closePreview(): void {
    this.isPreview = false;
    this.preview = null;
  }


  // Progress State
  progressCount: number = 0;
  totalCount: number = 0;
  progressPercent: number = 0;
  currentRecipientName: string = '';

  sendBulkSms(): void {
    if (!this.message) return;

    this.isSending = true;
    this.progressCount = 0;
    this.progressPercent = 0;

    // 1. Fetch Recipients
    // We use previewBulkSms which now returns 'recipients' array
    this.communicationService.previewBulkSms(this.recipientFilter).subscribe({
      next: (resp: any) => {
        if (!resp || !resp.recipients || resp.recipients.length === 0) {
          this.isSending = false;
          this.snack.open('No recipients found.', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
          return;
        }

        this.processQueue(resp.recipients);
      },
      error: (err: any) => {
        this.isSending = false;
        console.error(err);
        this.snack.open('Failed to fetch recipient list.', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
      }
    });
  }

  async processQueue(recipients: any[]) {
    this.totalCount = recipients.length;
    let sentCount = 0;
    let failedCount = 0;

    for (const r of recipients) {
      this.currentRecipientName = r.studentName || r.phoneNumber;

      try {
        if (r.phoneNumber) {
          // If simple bulk message (no placeholders) sending 1-by-1
          await this.communicationService.sendSingleSms(r.studentId, this.message).toPromise();
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (e) {
        failedCount++;
      }

      this.progressCount++;
      this.progressPercent = Math.round((this.progressCount / this.totalCount) * 100);
    }

    this.isSending = false;
    this.isPreview = false;
    this.preview = null;
    this.message = '';
    this.recipientFilter = 'All Students';

    this.snack.open(`Sent ${sentCount} SMS, Failed ${failedCount}.`, 'Close', { duration: 4000, panelClass: ['success-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' });
    this.communicationService.fetchSmsCreditBalance();
  }
}