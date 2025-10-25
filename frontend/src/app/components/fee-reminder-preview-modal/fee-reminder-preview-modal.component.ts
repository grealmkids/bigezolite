import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Student } from '../../services/student.service';
import { FeeRecord } from '../../services/fees.service';
import { CommunicationService } from '../../services/communication.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SchoolService, School } from '../../services/school.service';
import { FeesToTrackService } from '../../services/fees-to-track.service';

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
  mode: 'single' | 'report' = 'single';
  schoolName: string = '';
  rsvpNumber: string = '';
  feeName: string = '';

  constructor(
    private communicationService: CommunicationService,
    private snackBar: MatSnackBar,
    private schoolService: SchoolService,
    private feesToTrackService: FeesToTrackService
  ) {}

  ngOnInit(): void {
    try {
      const sel = this.schoolService['selectedSchool']?.value as School | null;
      if (sel) {
        this.schoolName = sel.school_name || '';
        this.rsvpNumber = sel.accountant_number || '';
      } else {
        const raw = localStorage.getItem('bigezo_selected_school');
        if (raw) {
          const s = JSON.parse(raw);
          this.schoolName = s?.school_name || '';
          this.rsvpNumber = s?.accountant_number || '';
        }
      }
    } catch {}
    // If a specific fee record is selected and has fee_id, fetch fee name
    const fid = this.feeRecord?.fee_id;
    if (fid) {
      this.feesToTrackService.getById(fid).subscribe({
        next: (f: any) => { this.feeName = f?.name || ''; this.generateMessage(); },
        error: () => { this.generateMessage(); }
      });
    } else {
      this.generateMessage();
    }
  }

  generateMessage(): void {
    if (!this.student) { this.message = ''; return; }

    if (this.mode === 'report') {
      // Summarized report across records (limit to 3 recent terms)
      const records = [...(this.allFeeRecords || [])].sort((a,b)=> (b.year - a.year) || (b.term - a.term));
      const top = records.slice(0, 3);
      const totalPaid = records.reduce((sum, r) => sum + (r.amount_paid || 0), 0);
      const totalDue = records.reduce((sum, r) => sum + (r.total_fees_due || 0), 0);
      const totalBal = totalDue - totalPaid;
      const lines = top.map(r => `T${r.term} ${r.year}: Bal ${this.formatCurrency(r.balance_due || 0)}`);
      const school = this.schoolName ? ` from ${this.schoolName}` : '';
      const rsvp = this.rsvpNumber ? ` RSVP: ${this.rsvpNumber}` : '';
      this.message = `Fees report for ${this.student.student_name}${school}. ${lines.join('; ')}. Total Paid ${this.formatCurrency(totalPaid)}, Balance ${this.formatCurrency(totalBal)}.${rsvp}`;
      return;
    }

    // Single-record message (based on selected feeRecord)
    if (!this.feeRecord) { this.message = ''; return; }
    const paid = this.feeRecord.amount_paid || 0;
    const bal = this.feeRecord.balance_due || 0;
    const total = this.feeRecord.total_fees_due || 0;
    const termYear = `Term ${this.feeRecord.term}, ${this.feeRecord.year}`;
    const dueDate = this.feeRecord.due_date ? this.formatDate(new Date(this.feeRecord.due_date)) : '';
    const feeLabel = this.feeName || 'School Fees';
    const rsvp = this.rsvpNumber ? ` RSVP: ${this.rsvpNumber}` : '';
    const schoolTag = this.schoolName ? ` -${this.schoolName}: ${termYear}` : ` -${termYear}`;
    const deadlineText = dueDate ? ` before ${dueDate}` : '';
    this.message = `Dear parent of ${this.student.student_name}, you have paid ${this.formatCurrency(paid)} out of ${this.formatCurrency(total)} for ${feeLabel}. Please pay Balance ${this.formatCurrency(bal)}${deadlineText}. Thank you.${rsvp}${schoolTag}`;
  }

  formatCurrency(amount: number): string {
    // Ensure amount is a number and format with commas, no decimals
    const numAmount = Number(amount) || 0;
    return `UGX ${Math.round(numAmount).toLocaleString('en-US')}`;
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
    // Send the composed message for this student
    this.communicationService.sendSingleSms(this.student.student_id, this.message).subscribe({
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
