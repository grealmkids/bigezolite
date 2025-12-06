import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { StaffService } from '../../../services/staff.service';
// import { ClassService } from '../../services/class.service'; // Assuming exists
// import { SubjectService } from '../../services/subject.service'; // Assuming exists

@Component({
    selector: 'app-staff-assignment-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatSelectModule,
        MatButtonModule
    ],
    templateUrl: './staff-assignment-dialog.component.html',
    styleUrls: ['./staff-assignment-dialog.component.scss']
})
export class StaffAssignmentDialogComponent implements OnInit {
    assignmentForm: FormGroup;
    type: 'subject' | 'class' = 'subject';

    // Mocks for now
    classes: any[] = [{ id: 1, name: 'P.1' }, { id: 2, name: 'P.2' }];
    subjects: any[] = [{ id: 1, name: 'Mathematics' }, { id: 2, name: 'English' }];

    private fb = inject(FormBuilder);
    private staffService = inject(StaffService);

    constructor(
        public dialogRef: MatDialogRef<StaffAssignmentDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { staffId: number, schoolId: number }
    ) {
        this.assignmentForm = this.fb.group({
            type: ['subject', Validators.required],
            class_id: ['', Validators.required],
            subject_id: [''], // Required if type is subject
            role: ['Class Teacher'] // Required if type is class
        });

        this.assignmentForm.get('type')?.valueChanges.subscribe(val => {
            this.type = val;
            if (val === 'subject') {
                this.assignmentForm.get('subject_id')?.setValidators(Validators.required);
                this.assignmentForm.get('role')?.clearValidators();
            } else {
                this.assignmentForm.get('subject_id')?.clearValidators();
                this.assignmentForm.get('role')?.setValidators(Validators.required);
            }
            this.assignmentForm.get('subject_id')?.updateValueAndValidity();
            this.assignmentForm.get('role')?.updateValueAndValidity();
        });
    }

    ngOnInit(): void {
        // Load classes and subjects from services
    }

    onSubmit(): void {
        if (this.assignmentForm.valid) {
            const val = this.assignmentForm.value;
            if (val.type === 'subject') {
                this.staffService.assignSubject(this.data.staffId, this.data.schoolId, val.subject_id, val.class_id)
                    .subscribe({
                        next: () => this.dialogRef.close(true),
                        error: (err) => console.error(err)
                    });
            } else {
                this.staffService.assignClass(this.data.staffId, this.data.schoolId, val.class_id, val.role)
                    .subscribe({
                        next: () => this.dialogRef.close(true),
                        error: (err) => console.error(err)
                    });
            }
        }
    }
}
