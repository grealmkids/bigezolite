import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Student } from '../../services/student.service';
import { FeesService, FeeRecord, NewFeeRecord } from '../../services/fees.service';
import { SchoolService } from '../../services/school.service';

@Component({
  selector: 'app-fees-management-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
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

  constructor(
    private fb: FormBuilder,
    private feesService: FeesService,
    private schoolService: SchoolService
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
        },
        error: (err) => {
          console.error('[FeesModal] Error loading fee records:', err);
          this.feeRecords = [];
        }
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
}