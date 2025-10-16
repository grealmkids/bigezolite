import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { School, SchoolService } from '../../services/school.service';
import { Inject } from '@angular/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-school-edit-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatSnackBarModule
  ],
  templateUrl: './school-edit-modal.component.html',
  styleUrls: ['./school-edit-modal.component.scss']
})
export class SchoolEditModalComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<SchoolEditModalComponent>);
  private schoolService = inject(SchoolService);
  private snack = inject(MatSnackBar);

  data!: { school: School };

  form = this.fb.group({
    school_name: ['', [Validators.required, Validators.maxLength(120)]],
    admin_phone: ['', [Validators.required]],
    location_district: [''],
    student_count_range: [''],
    school_type: ['']
  });

  constructor(@Inject(MAT_DIALOG_DATA) data: { school: School }) {
    this.data = data;
    // initialize form with provided data
    this.form.patchValue({
      school_name: data.school.school_name || '',
      admin_phone: data.school.admin_phone || '',
      location_district: data.school.location_district || '',
      student_count_range: data.school.student_count_range || '',
      school_type: data.school.school_type || ''
    });
  }

  save(): void {
    if (this.form.invalid) return;
    const val = this.form.value;
    const updates: Partial<School> = {
      school_name: val.school_name || undefined,
      admin_phone: val.admin_phone || undefined,
      location_district: val.location_district || undefined,
      student_count_range: val.student_count_range || undefined,
      school_type: val.school_type || undefined
    };

    this.schoolService.updateMySchool(this.data.school.school_id, updates).subscribe({
      next: (updated) => {
        this.snack.open('School updated successfully', undefined, { duration: 2500 });
        this.dialogRef.close(updated);
      },
      error: (err) => {
        console.error('Failed to update school', err);
        this.snack.open('Failed to update school', 'Dismiss', { duration: 4000 });
      }
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
