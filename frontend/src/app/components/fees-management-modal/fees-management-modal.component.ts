import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Student } from '../../services/student.service';
import { FeesService, FeeRecord, NewFeeRecord } from '../../services/fees.service';
import { SchoolService } from '../../services/school.service';
import { CommunicationService } from '../../services/communication.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FeeReminderPreviewModalComponent } from '../fee-reminder-preview-modal/fee-reminder-preview-modal.component';
import { FeesToTrackService } from '../../services/fees-to-track.service';

@Component({
  selector: 'app-fees-management-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, FeeReminderPreviewModalComponent],
  templateUrl: './fees-management-modal.component.html',
  styleUrls: ['./fees-management-modal.component.scss']
})
export class FeesManagementModalComponent implements OnInit {
  @Input() student: Student | null = null;
  @Output() close = new EventEmitter<void>();

  feeRecords: FeeRecord[] = [];
  feeForm: FormGroup;
  editingRecordId: number | null = null;
  editingAmountPaid: number | null = null;

  // fee name cache by fee_id
  feeNames: Record<number, string> = {};
  
  // Fee reminder preview modal
  showReminderPreview: boolean = false;
  selectedFeeRecord: FeeRecord | null = null;

  constructor(
    private fb: FormBuilder,
    private feesService: FeesService,
    private schoolService: SchoolService,
    private communicationService: CommunicationService,
    private snackBar: MatSnackBar,
    private feesToTrackService: FeesToTrackService
  ) {
    this.feeForm = this.fb.group({
      term: [1, Validators.required],
      year: [new Date().getFullYear(), Validators.required],
      total_fees_due: ['', [Validators.required, Validators.min(0)]],
      due_date: ['', Validators.required],
      rsvp_number: [''] // Optional
    });
  }

  ngOnInit(): void {
    if (this.student) {
      this.loadFeeRecords();
    }
    // Pre-fill RSVP number from school's accountant_number if available
    const schoolId = this.schoolService.getSelectedSchoolId();
    if (schoolId) {
      this.schoolService.selectedSchool$.subscribe(school => {
        if (school && school.accountant_number) {
          this.feeForm.patchValue({ rsvp_number: school.accountant_number });
        }
      });
    }
  }

  loadFeeRecords(): void {
    if (this.student) {
      this.feesService.getFeeRecords(this.student.student_id).subscribe({
        next: (records) => {
          this.feeRecords = records;
          console.log('[FeesModal] Loaded fee records:', records);
          this.populateFeeNames();
        },
        error: (err) => {
          console.error('[FeesModal] Error loading fee records:', err);
          this.feeRecords = [];
        }
      });
    }
  }

  private populateFeeNames(): void {
    // fetch unique fee_ids and cache names; default to 'School Fees'
    const ids = Array.from(new Set((this.feeRecords || []).map(r => r.fee_id).filter(Boolean))) as number[];
    for (const id of ids) {
      if (this.feeNames[id]) continue;
      this.feesToTrackService.getById(id).subscribe({
        next: (f: any) => { this.feeNames[id] = f?.name || 'School Fees'; },
        error: () => { this.feeNames[id] = 'School Fees'; }
      });
    }
  }

  onAddFeeRecord(): void {
    if (this.feeForm.invalid || !this.student) {
      console.warn('[FeesModal] Form invalid or no student', { invalid: this.feeForm.invalid, student: this.student });
      return;
    }
    const newRecord: NewFeeRecord = this.feeForm.value;
    console.log('[FeesModal] Creating fee record:', newRecord, 'for student:', this.student.student_id);
    this.feesService.createFeeRecord(this.student.student_id, newRecord).subscribe({
      next: (result) => {
        console.log('[FeesModal] Fee record created successfully:', result);
        this.loadFeeRecords(); // Refresh the list
        this.feeForm.reset({ term: 1, year: new Date().getFullYear() }); // Reset form
      },
      error: (err) => {
        console.error('[FeesModal] Error creating fee record:', err);
        alert(`Failed to create fee record: ${err?.error?.message || err?.message || 'Unknown error'}`);
      }
    });
  }

  startEditing(record: FeeRecord): void {
    this.editingRecordId = record.fee_record_id;
    this.editingAmountPaid = record.amount_paid;
  }

  cancelEditing(): void {
    this.editingRecordId = null;
    this.editingAmountPaid = null;
  }

  onUpdateFeeRecord(recordId: number): void {
    if (this.editingAmountPaid !== null) {
        console.log('[FeesModal] Updating fee record:', recordId, 'amount:', this.editingAmountPaid);
        this.feesService.updateFeeRecord(recordId, this.editingAmountPaid).subscribe({
          next: (result) => {
            console.log('[FeesModal] Fee record updated successfully:', result);
            this.loadFeeRecords(); // Refresh the list
            this.cancelEditing(); // Exit edit mode and reset
          },
          error: (err) => {
            console.error('[FeesModal] Error updating fee record:', err);
            alert(`Failed to update fee record: ${err?.error?.message || err?.message || 'Unknown error'}`);
          }
        });
    }
  }

  onDeleteRecord(record: FeeRecord): void {
    if (!confirm('Delete this fee record? This cannot be undone.')) return;
    this.feesService.deleteFeeRecord(record.fee_record_id).subscribe({
      next: () => {
        this.snackBar.open('Fee record deleted', 'Close', { duration: 2500, panelClass: ['success-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' });
        this.loadFeeRecords();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to delete fee record', 'Close', { duration: 4000, panelClass: ['error-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' });
      }
    });
  }

  openReminderPreview(record: FeeRecord): void {
    // Calculate total balance from all fee records
    const totalBalance = this.feeRecords.reduce((sum, rec) => sum + (rec.balance_due || 0), 0);
    
    if (totalBalance <= 0) {
      this.snackBar.open('This student has no outstanding balance', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar'],
        verticalPosition: 'top',
        horizontalPosition: 'center'
      });
      return;
    }

    this.selectedFeeRecord = record;
    this.showReminderPreview = true;
  }

  closeReminderPreview(): void {
    this.showReminderPreview = false;
    this.selectedFeeRecord = null;
  }

  // Helpers for UI coloring and status
  deriveFeesStatus(total?: number, paid?: number, balance?: number): 'Paid' | 'Partially Paid' | 'Defaulter' {
    const b = Number(balance || 0);
    const p = Number(paid || 0);
    if (b <= 0) return 'Paid';
    if (p > 0) return 'Partially Paid';
    return 'Defaulter';
  }

  feesClassFromLabel(label: string): string {
    const s = (label || '').toLowerCase();
    if (s === 'partially paid') return 'pending';
    return s; // 'paid' | 'defaulter'
  }
}
