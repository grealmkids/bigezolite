import { Component, inject, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { School, SchoolService } from '../../services/school.service';

@Component({
  selector: 'app-school-edit-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './school-edit-modal.component.html',
  styleUrls: ['./school-edit-modal.component.scss']
})
export class SchoolEditModalComponent {
  private fb = inject(FormBuilder);
  private schoolService = inject(SchoolService);
  @Input() school?: School | null = null;
  @Output() saved = new EventEmitter<School>();
  @Output() closed = new EventEmitter<void>();

  form = this.fb.group({
    school_name: ['', [Validators.required, Validators.maxLength(120)]],
    admin_phone: ['', [Validators.required]],
    location_district: [''],
    student_count_range: [''],
    school_type: ['']
  });

  // When used as a parent-driven modal, patch the form when `school` input changes
  ngOnChanges(changes: SimpleChanges) {
    if (changes['school'] && this.school) {
      const s = this.school;
      this.form.patchValue({
        school_name: s.school_name || '',
        admin_phone: s.admin_phone || '',
        location_district: s.location_district || '',
        student_count_range: s.student_count_range || '',
        school_type: s.school_type || ''
      });
    }
  }

  save(): void {
    if (this.form.invalid || !this.school) return;
    const val = this.form.value;
    const updates: Partial<School> = {
      school_name: val.school_name || undefined,
      admin_phone: val.admin_phone || undefined,
      location_district: val.location_district || undefined,
      student_count_range: val.student_count_range || undefined,
      school_type: val.school_type || undefined
    };

    this.schoolService.updateMySchool(this.school.school_id, updates).subscribe({
      next: (updated) => {
        // emit updated school to parent
        this.saved.emit(updated);
      },
      error: (err) => {
        console.error('Failed to update school', err);
        // optionally emit closed so parent can react; keep modal open for manual retry
      }
    });
  }

  cancel(): void {
    this.closed.emit();
  }
}
