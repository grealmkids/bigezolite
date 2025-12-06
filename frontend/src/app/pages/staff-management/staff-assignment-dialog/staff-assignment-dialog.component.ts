import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { StaffService } from '../../../services/staff.service';
import { ClassCategorizationService } from '../../../services/class-categorization.service';
import { MarksService } from '../../../services/marks.service';
import { SchoolService } from '../../../services/school.service';

@Component({
    selector: 'app-staff-assignment-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatSelectModule,
        MatButtonModule,
        MatProgressBarModule
    ],
    templateUrl: './staff-assignment-dialog.component.html',
    styleUrls: ['./staff-assignment-dialog.component.scss']
})
export class StaffAssignmentDialogComponent implements OnInit {
    assignmentForm: FormGroup;
    type: 'subject' | 'class' = 'subject';
    isLoadingSubjects = false;

    // Real data
    classes: { id: string, name: string }[] = [];
    subjects: { id: number, name: string }[] = [];

    private fb = inject(FormBuilder);
    private staffService = inject(StaffService);
    private classService = inject(ClassCategorizationService);
    private marksService = inject(MarksService);
    private schoolService = inject(SchoolService);

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

        // Dynamic Subject Loading
        this.assignmentForm.get('class_id')?.valueChanges.subscribe(className => {
            if (className && this.type === 'subject') {
                this.fetchSubjects(className);
            } else {
                this.subjects = [];
            }
        });
    }

    ngOnInit(): void {
        const schoolType = this.schoolService.getSelectedSchoolType() || 'Primary (Local)';
        const rawClasses = this.classService.getClassesForSchoolType(schoolType);
        this.classes = rawClasses.map((c, i) => ({ id: c, name: c }));
    }

    fetchSubjects(className: string): void {
        this.isLoadingSubjects = true;
        this.subjects = []; // Clear previous

        let level = 'Primary';
        if (className.startsWith('S') || className.startsWith('Year 7') || className.startsWith('Year 8')) {
            level = 'Secondary';
        } else if (className.startsWith('K') || className.startsWith('Top') || className.startsWith('Middle') || className.startsWith('Baby')) {
            level = 'Nursery';
        }

        this.marksService.getSubjects(this.data.schoolId, level).subscribe({
            next: (subs) => {
                this.subjects = subs.map(s => ({ id: s.subject_id, name: s.subject_name }));
                this.isLoadingSubjects = false;
            },
            error: (err) => {
                console.error('Failed to load subjects', err);
                this.isLoadingSubjects = false;
            }
        });
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
