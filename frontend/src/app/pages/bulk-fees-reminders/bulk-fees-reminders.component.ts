import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { BulkFeesPreviewDialogComponent } from '../../components/bulk-fees-preview-dialog/bulk-fees-preview-dialog.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { CommunicationService } from '../../services/communication.service';
import { SchoolService } from '../../services/school.service';
import { ClassCategorizationService } from '../../services/class-categorization.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-bulk-fees-reminders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
    MatExpansionModule,
    MatCardModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './bulk-fees-reminders.component.html',
  styleUrls: ['./bulk-fees-reminders.component.scss']
})
export class BulkFeesRemindersComponent implements OnInit {
  thresholdAmount: number = 1000;
  customDeadline: string = ''; // Optional deadline
  selectedClass: string = 'All Students';
  selectedStatus: string = 'Active';
  selectedYear: string = new Date().getFullYear().toString();
  selectedTerm: string = '';
  selectedFeesStatus: string = 'Defaulter';
  messageType: 'detailed' | 'sent_home' | 'custom' | 'generic' = 'detailed';
  messageTemplate: string = '';
  isSending: boolean = false;
  isLoadingPreview: boolean = false;

  // Filter options
  classes: string[] = ['All Students'];
  years: string[] = ['2023', '2024', '2025'];
  terms: string[] = ['', '1', '2', '3'];
  studentStatuses: string[] = ['All Statuses', 'Active', 'Inactive', 'Expelled', 'Alumni', 'Suspended', 'Sick'];
  feesStatuses: string[] = ['', 'Paid', 'Pending', 'Defaulter'];
  loadingClasses: boolean = false;

  constructor(
    private communicationService: CommunicationService,
    private schoolService: SchoolService,
    private classCategorizationService: ClassCategorizationService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) { }

  onMessageTypeChange(type: 'detailed' | 'sent_home' | 'custom' | 'generic'): void {
    this.messageType = type;
    if (type === 'sent_home' && !this.messageTemplate.trim()) {
      this.messageTemplate = "Dear parent of {child's name}, we have sent your child back home for {fee_name} today {today's date}. {RSVP number} - {School name}.";
    }
    if (type === 'detailed' || type === 'generic') {
      this.messageTemplate = '';
    }
  }

  // School Details for SMS
  schoolName: string = '';
  rsvpNumber: string = '';

  ngOnInit(): void {
    this.loadingClasses = true;
    try {
      const schoolType = this.schoolService.getSelectedSchoolType();
      if (schoolType) {
        const schoolClasses = this.classCategorizationService.getClassesForSchoolType(schoolType);
        this.classes = ['All Students', ...schoolClasses];
      }

      // Subscribe to selected school to get name and RSVP info
      this.schoolService.selectedSchool$.subscribe(school => {
        if (school) {
          this.schoolName = school.school_name;
          this.rsvpNumber = school.accountant_number || '';
        }
      });
      // Trigger fetch if not loaded
      if (!this.schoolService.getSelectedSchoolId()) {
        this.schoolService.getMySchool().subscribe();
      }

    } catch (err) {
      console.error('Error loading classes:', err);
    } finally {
      this.loadingClasses = false;
    }
  }

  loadPreview(): void {
    if (this.thresholdAmount < 0) {
      this.snackBar.open('Please enter a valid threshold amount', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar'],
        verticalPosition: 'top',
        horizontalPosition: 'center'
      });
      return;
    }

    const payload: any = {
      thresholdAmount: this.thresholdAmount,
      classFilter: this.selectedClass === 'All Students' ? undefined : this.selectedClass,
      statusFilter: this.selectedStatus === 'All Statuses' ? undefined : this.selectedStatus,
      customDeadline: this.customDeadline || undefined,
      year: this.selectedYear || undefined,
      term: this.selectedTerm || undefined,
      feesStatus: this.selectedFeesStatus || undefined,
      messageType: this.messageType,
      messageTemplate: this.messageTemplate
    };

    console.log('[BulkFeesPreview][payload]', payload);
    this.isLoadingPreview = true;
    this.communicationService.previewBulkFeesReminders(
      payload.thresholdAmount,
      payload.classFilter,
      payload.statusFilter,
      payload.customDeadline,
      payload.year,
      payload.term,
      payload.feesStatus,
      payload.messageType,
      payload.messageTemplate
    ).subscribe({
      next: (response: any) => {
        this.isLoadingPreview = false;
        console.log('[BulkFeesPreview][response]', response);

        // Open Dialog with preview data
        const dialogRef = this.dialog.open(BulkFeesPreviewDialogComponent, {
          width: '600px',
          disableClose: true,
          data: response
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result === true) {
            this.sendBulkReminders(response); // Pass preview data to avoid re-fetching if needed, or just use current state
          }
        });
      },
      error: (err: any) => {
        this.isLoadingPreview = false;
        this.snackBar.open(
          err?.error?.message || 'Failed to load preview',
          'Close',
          {
            duration: 4000,
            panelClass: ['error-snackbar'],
            verticalPosition: 'top',
            horizontalPosition: 'center'
          }
        );
      }
    });
  }

  // Progress State
  progressCount: number = 0;
  totalCount: number = 0;
  progressPercent: number = 0;
  currentRecipientName: string = '';

  sendBulkReminders(previewData?: any): void {
    if (this.thresholdAmount < 0) {
      this.snackBar.open('Please enter a valid threshold amount', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar'],
        verticalPosition: 'top',
        horizontalPosition: 'center'
      });
      return;
    }

    // Logic: use previewData if available, OR fetch it now if not (e.g. if we skipped preview)
    // Note: previewBulkFeesReminders returns { recipients, ... }

    const startSendingProcess = (data: any) => {
      if (!data || !data.recipients || data.recipients.length === 0) {
        this.snackBar.open('No recipients found to send to.', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
        return;
      }

      const recipients = data.recipients;
      this.totalCount = recipients.length;
      this.progressCount = 0;
      this.progressPercent = 0;
      this.isSending = true;

      this.processQueue(recipients);
    };

    if (previewData && previewData.recipients) {
      startSendingProcess(previewData);
    } else {
      // Fetch data first
      this.isLoadingPreview = true;
      this.fetchPreviewData().subscribe({
        next: (resp) => {
          this.isLoadingPreview = false;
          startSendingProcess(resp);
        },
        error: (err) => {
          this.isLoadingPreview = false;
          this.snackBar.open('Failed to prepare recipient list.', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
        }
      });
    }
  }

  fetchPreviewData() {
    return this.communicationService.previewBulkFeesReminders(
      this.thresholdAmount,
      this.selectedClass === 'All Students' ? undefined : this.selectedClass,
      this.selectedStatus === 'All Statuses' ? undefined : this.selectedStatus,
      this.customDeadline || undefined,
      this.selectedYear || undefined,
      this.selectedTerm || undefined,
      this.selectedFeesStatus || undefined,
      this.messageType,
      this.messageTemplate
    );
  }

  async processQueue(recipients: any[]) {
    let sentCount = 0;
    let failedCount = 0;

    const rsvpNumber = this.rsvpNumber || '';
    const schoolName = this.schoolName || '';

    const defaultTemplate = "Dear parent of {child's name}, we have sent your child back home for {fee_name} today {today's date}. {RSVP number} - {School name}.";
    const templateToUse = this.messageType === 'sent_home' ? (this.messageTemplate && this.messageTemplate.trim() ? this.messageTemplate : defaultTemplate) : (this.messageTemplate || '');

    for (const recipient of recipients) {
      this.currentRecipientName = recipient.studentName;
      let message = '';

      // 1. Construct Message
      if (this.messageType === 'detailed') {
        // Use helper if simpler, or construct here
        const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
        const dueDateText = recipient.dueDate ? new Date(recipient.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '';
        const deadlineText = dueDateText ? ` before ${dueDateText}` : '';
        const feeLabel = recipient.feeName || 'School Fees';
        const termYear = recipient.term && recipient.year ? ` Term ${recipient.term}, ${recipient.year}` : '';
        message = `Dear parent of ${recipient.studentName}, you have paid ${fmt(recipient.amountPaid)} out of ${fmt(recipient.totalDue)} for ${feeLabel}. Please pay Balance ${fmt(recipient.balance)}${deadlineText}. Thank you.${termYear}`;

      } else if (this.messageType === 'generic') {
        const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
        const dueDateText = recipient.dueDate ? new Date(recipient.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '';
        const deadlineText = dueDateText ? ` before ${dueDateText}` : '';
        message = `Dear parent of ${recipient.studentName}, you have so far paid ${fmt(recipient.amountPaid)}. Kindly pay the remaining School fees balance of ${fmt(recipient.balance)}${deadlineText}.`;

      } else {
        // Custom or Sent Home - Use Template Interpolation
        const dueDateText = recipient.dueDate ? new Date(recipient.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '';
        message = templateToUse
          .replace(/\{\s*child(?:'s)?[\s_]*name\s*\}/gi, recipient.studentName || '')
          .replace(/\{\s*child[\s_]*name\s*\}/gi, recipient.studentName || '')
          .replace(/\{\s*student[\s_]*name\s*\}/gi, recipient.studentName || '')
          .replace(/\{\s*fee(?:s?_to_)?track\s*\}/gi, recipient.feeName || 'fees')
          .replace(/\{\s*fee[\s_]*name\s*\}/gi, recipient.feeName || 'fees')
          .replace(/\{\s*today(?:'s)?[\s_]*date\s*\}/gi, new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'))
          .replace(/\{\s*rsvp(?:[\s_]*number)?\s*\}/gi, rsvpNumber)
          .replace(/\{\s*school(?:[\s_]*name)?\s*\}/gi, schoolName)
          .replace(/\{\s*term\s*\}/gi, recipient.term || '')
          .replace(/\{\s*year\s*\}/gi, recipient.year || '')
          .replace(/\{\s*balance\s*\}/gi, String(recipient.balance))
          .replace(/\{\s*amount[\s_]*paid\s*\}/gi, String(recipient.amountPaid))
          .replace(/\{\s*total[\s_]*due\s*\}/gi, String(recipient.totalDue))
          .replace(/\{\s*due[\s_]*date\s*\}/gi, dueDateText);
      }

      // 2. Send Single SMS
      try {
        if (recipient.phoneNumber) {
          await this.communicationService.sendSingleSms(recipient.studentId, message).toPromise();
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (e) {
        console.error('Failed to send to', recipient.studentName, e);
        failedCount++;
      }

      // 3. Update Progress
      this.progressCount++;
      this.progressPercent = Math.round((this.progressCount / this.totalCount) * 100);
    }

    // Finish
    this.isSending = false;
    this.snackBar.open(
      `Process complete. Sent ${sentCount}, Failed ${failedCount}.`,
      'Close',
      { duration: 5000, panelClass: ['success-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' }
    );

    // Refresh credit balance
    this.communicationService.fetchSmsCreditBalance();
  }
}
