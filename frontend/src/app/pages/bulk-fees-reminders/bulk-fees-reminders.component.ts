import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommunicationService } from '../../services/communication.service';
import { SchoolService } from '../../services/school.service';
import { ClassCategorizationService } from '../../services/class-categorization.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-bulk-fees-reminders',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  showPreview: boolean = false;

  // Preview data
  previewData: any = null;

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
    private snackBar: MatSnackBar
  ) {}

  onMessageTypeChange(type: 'detailed' | 'sent_home' | 'custom' | 'generic'): void {
    this.messageType = type;
    if (type === 'sent_home' && !this.messageTemplate.trim()) {
      this.messageTemplate = "Dear parent of {child's name}, we have sent your child back home for {fee_name} today {today's date}. {RSVP number} - {School name}.";
    }
    if (type === 'detailed' || type === 'generic') {
      this.messageTemplate = '';
    }
  }

  ngOnInit(): void {
    this.loadingClasses = true;
    try {
      const schoolType = this.schoolService.getSelectedSchoolType();
      if (schoolType) {
        const schoolClasses = this.classCategorizationService.getClassesForSchoolType(schoolType);
        this.classes = ['All Students', ...schoolClasses];
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
      next: (response) => {
        this.isLoadingPreview = false;
        this.previewData = response;
        this.showPreview = true;
      },
      error: (err) => {
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

  cancelPreview(): void {
    this.showPreview = false;
    this.previewData = null;
  }

  sendBulkReminders(): void {
    if (this.thresholdAmount < 0) {
      this.snackBar.open('Please enter a valid threshold amount', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar'],
        verticalPosition: 'top',
        horizontalPosition: 'center'
      });
      return;
    }

    // Prepare request payload
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

    this.isSending = true;
    this.communicationService.sendBulkFeesReminders(
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
      next: (response) => {
        this.isSending = false;
        const count = this.previewData?.recipientCount || response?.sentCount || 0;
        this.snackBar.open(
          `Successfully sent ${count} fees reminder${count !== 1 ? 's' : ''}!`,
          'Close',
          {
            duration: 5000,
            panelClass: ['success-snackbar'],
            verticalPosition: 'top',
            horizontalPosition: 'center'
          }
        );
        // Reset preview and go back to settings
        this.cancelPreview();
      },
      error: (err) => {
        this.isSending = false;
        this.snackBar.open(
          err?.error?.message || 'Failed to send fees reminders',
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
}
