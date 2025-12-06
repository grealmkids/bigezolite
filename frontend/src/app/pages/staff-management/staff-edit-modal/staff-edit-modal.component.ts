import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StaffService, Staff } from '../../../services/staff.service';

@Component({
    selector: 'app-staff-edit-modal',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule
    ],
    templateUrl: './staff-edit-modal.component.html',
    styleUrls: ['./staff-edit-modal.component.scss']
})
export class StaffEditModalComponent implements OnInit {
    staffForm: FormGroup;
    isEditMode = false;
    roles = ['Teacher', 'Class Teacher', 'Accountant', 'IT', 'Canteen', 'Other'];
    selectedFile: File | null = null;
    photoPreview: string | null = null;

    private fb = inject(FormBuilder);
    private staffService = inject(StaffService);

    constructor(
        public dialogRef: MatDialogRef<StaffEditModalComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { staff?: Staff, schoolId: number }
    ) {
        this.isEditMode = !!data.staff;
        this.staffForm = this.fb.group({
            first_name: [data.staff?.first_name || '', Validators.required],
            last_name: [data.staff?.last_name || '', Validators.required],
            gender: [data.staff?.gender || 'Male', Validators.required],
            email: [data.staff?.email || '', [Validators.required, Validators.email]],
            phone: [data.staff?.phone || '', Validators.required],
            role: [data.staff?.role || 'Teacher', Validators.required],
            allow_password_login: [data.staff?.allow_password_login ?? true]
        });

        if (data.staff?.photo_url) {
            this.photoPreview = data.staff.photo_url;
        }
    }

    ngOnInit(): void { }

    onFileSelected(event: any): void {
        const file = event.target.files[0];
        if (file) {
            this.selectedFile = file;
            const reader = new FileReader();
            reader.onload = () => {
                this.photoPreview = reader.result as string;
            };
            reader.readAsDataURL(file);
        }
    }

    onSubmit(): void {
        if (this.staffForm.valid) {
            const formValue = this.staffForm.value;
            const staffData: Staff = {
                ...formValue,
                school_id: this.data.schoolId,
                is_active: true // Default active
            };

            if (this.isEditMode && this.data.staff?.staff_id) {
                // Update
                this.staffService.updateStaff(this.data.staff.staff_id, this.data.schoolId, staffData).subscribe({
                    next: (updatedStaff: Staff) => {
                        // Handle photo upload if file selected (Separate step or integrated?)
                        // For now, assume photo upload is handled separately or we need to implement it.
                        // PRD says: Upload photo -> Backblaze folder
                        // We need a service method for photo upload.
                        this.dialogRef.close(true);
                    },
                    error: (err: any) => console.error('Update failed', err)
                });
            } else {
                // Create
                this.staffService.createStaff(staffData).subscribe({
                    next: (newStaff: Staff) => {
                        // Handle photo upload if file selected
                        this.dialogRef.close(true);
                    },
                    error: (err: any) => console.error('Create failed', err)
                });
            }
        }
    }

    onCancel(): void {
        this.dialogRef.close(false);
    }
}
