import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Student } from '../../services/student.service';
import { FeesService, FeeRecord, NewFeeRecord } from '../../services/fees.service';

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

  constructor(private fb: FormBuilder, private feesService: FeesService) {
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
  }

  loadFeeRecords(): void {
    if (this.student) {
      this.feesService.getFeeRecords(this.student.student_id).subscribe(records => {
        this.feeRecords = records;
      });
    }
  }

  onAddFeeRecord(): void {
    if (this.feeForm.invalid || !this.student) {
      return;
    }
    const newRecord: NewFeeRecord = this.feeForm.value;
    this.feesService.createFeeRecord(this.student.student_id, newRecord).subscribe(() => {
      this.loadFeeRecords(); // Refresh the list
      this.feeForm.reset({ term: 1, year: new Date().getFullYear() }); // Reset form
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
        this.feesService.updateFeeRecord(recordId, this.editingAmountPaid).subscribe(() => {
            this.loadFeeRecords(); // Refresh the list
            this.cancelEditing(); // Exit edit mode and reset
        });
    }
  }
}