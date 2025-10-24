import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Student } from '../../services/student.service';
import { FeeRecord } from '../../services/fees.service';
import { CommunicationService } from '../../services/communication.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-fee-reminder-preview-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fee-reminder-preview-modal.component.html',
  styleUrls: ['./fee-reminder-preview-modal.component.scss']
})
export class FeeReminderPreviewModalComponent implements OnInit {
  @Input() student: Student | null = null;
  @Input() feeRecord: FeeRecord | null = null;
  @Input() allFeeRecords: FeeRecord[] = [];
  @Output() close = new EventEmitter<void>();

  message: string = '';
  isSending: boolean = false;

  constructor(
    private communicationService: CommunicationService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.generateMessage();
  }

  generateMessage(): void {
    if (!this.student || !this.feeRecord || this.allFeeRecords.length === 0) {
      this.message = '';
      return;
    }

    // Calculate total amount paid and total balance from all records
    const totalPaid = this.allFeeRecords.reduce((sum, record) => sum + (record.amount_paid || 0), 0);
    const totalBalance = this.allFeeRecords.reduce((sum, record) => sum + (record.balance_due || 0), 0);

    // Format amounts without decimals
    const formattedPaid = this.formatCurrency(totalPaid);
    const formattedBalance = this.formatCurrency(totalBalance);

    // Format due date as DD-MMM-YYYY
    const dueDate = this.feeRecord.due_date ? this.formatDate(new Date(this.feeRecord.due_date)) : '';
    const deadlineText = dueDate ? ` before ${dueDate}` : '';

    this.message = `Dear parent of ${this.student.student_name}, you have so far paid ${formattedPaid}. Kindly pay the remaining School fees balance of ${formattedBalance}${deadlineText}.`;
  }

  formatCurrency(amount: number): string {
    return `UGX ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  get messageLength(): number {
    return this.message.length;
  }

  get smsUnits(): number {
    return Math.ceil(this.messageLength / 160);
  }

  sendReminder(): void {
    if (!this.student || !this.message.trim()) {
      return;
    }

    this.isSending = true;
    this.communicationService.sendFeesReminder(this.student.student_id).subscribe({
      next: () => {
        this.isSending = false;
        this.snackBar.open('Fees reminder sent successfully!', 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar'],
          verticalPosition: 'top',
          horizontalPosition: 'center'
        });
        this.close.emit();
      },
      error: (err) => {
        this.isSending = false;
        this.snackBar.open(
          err?.error?.message || 'Failed to send fees reminder',
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
