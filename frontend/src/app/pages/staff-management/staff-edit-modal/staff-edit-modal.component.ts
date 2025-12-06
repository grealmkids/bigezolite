import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpEventType } from '@angular/common/http';
import { StaffService, Staff } from '../../../services/staff.service';

@Component({
    selector: 'app-staff-edit-modal',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule
    ],
    templateUrl: './staff-edit-modal.component.html',
    styleUrls: ['./staff-edit-modal.component.scss']
})
export class StaffEditModalComponent implements OnInit {
    staffForm: FormGroup;
    isEditMode = false;
    roles: string[] = ['Teacher', 'Class Teacher', 'Accountant', 'IT', 'Canteen', 'Other'];
    selectedFile: File | null = null;
    photoPreview: string | null = null;
    uploadProgress: number = 0;
    isUploading: boolean = false;
    errorMessage: string | null = null;

    private fb = inject(FormBuilder);
    private staffService = inject(StaffService);
    private snackBar = inject(MatSnackBar);

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

    get canUploadPhoto(): boolean {
        try {
            const schoolData = localStorage.getItem('bigezo_selected_school');
            if (schoolData) {
                const school = JSON.parse(schoolData);
                return (school.account_status || '').toLowerCase() === 'active';
            }
        } catch (e) {
            console.error('Error parsing school data', e);
        }
        return false;
    }

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
        if (this.staffForm.invalid) {
            return;
        }

        const formValue = this.staffForm.value;
        const staffData: Staff = {
            ...formValue,
            school_id: this.data.schoolId,
            is_active: true // Default active
        };

        const successMessage = this.isEditMode ? 'Staff updated successfully!' : 'Staff created successfully!';

        if (this.isEditMode && this.data.staff?.staff_id) {
            // Update
            this.staffService.updateStaff(this.data.staff.staff_id, this.data.schoolId, staffData).subscribe({
                next: (updatedStaff: Staff) => {
                    this.handlePhotoUpload(this.data.staff!.staff_id!, successMessage);
                },
                error: (err: any) => {
                    console.error('Update failed', err);
                    this.errorMessage = 'Failed to update staff member.';
                }
            });
        } else {
            // Create
            this.staffService.createStaff(staffData).subscribe({
                next: (newStaff: Staff) => {
                    // Cast as any because the backend reponse might adhere to a slightly different structure or Typescript is strict
                    const staffId = (newStaff as any).staff_id || (newStaff as any).id;
                    if (staffId) {
                        this.handlePhotoUpload(staffId, successMessage);
                    } else {
                        this.dialogRef.close(true);
                    }
                },
                error: (err: any) => {
                    console.error('Create failed', err);
                    this.errorMessage = 'Failed to create staff member.';
                }
            });
        }
    }

    handlePhotoUpload(staffId: number, successMessage: string): void {
        if (this.selectedFile && this.canUploadPhoto) {
            this.isUploading = true;
            this.staffService.uploadStaffPhoto(staffId, this.selectedFile).subscribe({
                next: (event) => {
                    if (event.type === HttpEventType.UploadProgress) {
                        this.uploadProgress = Math.round(100 * event.loaded / event.total);
                    } else if (event.type === HttpEventType.Response) {
                        this.isUploading = false;
                        this.snackBar.open(successMessage + ' Photo uploaded.', 'Close', {
                            duration: 3000,
                            panelClass: ['success-snackbar'],
                            verticalPosition: 'top',
                            horizontalPosition: 'center'
                        });
                        this.dialogRef.close(true);
                    }
                },
                error: (err) => {
                    console.error('Photo upload failed', err);
                    this.isUploading = false;
                    this.snackBar.open(successMessage + ' But photo upload failed.', 'Close', {
                        duration: 4000,
                        panelClass: ['warning-snackbar'],
                        verticalPosition: 'top',
                        horizontalPosition: 'center'
                    });
                    this.dialogRef.close(true);
                }
            });
        } else {
            this.snackBar.open(successMessage, 'Close', {
                duration: 3000,
                panelClass: ['success-snackbar'],
                verticalPosition: 'top',
                horizontalPosition: 'center'
            });
            this.dialogRef.close(true);
        }
    }

    uploadPhoto(): void {
        if (!this.selectedFile || !this.data.staff?.staff_id) return;

        this.isUploading = true;
        this.staffService.uploadStaffPhoto(this.data.staff.staff_id, this.selectedFile).subscribe({
            next: (event) => {
                if (event.type === HttpEventType.UploadProgress) {
                    this.uploadProgress = Math.round(100 * event.loaded / event.total);
                } else if (event.type === HttpEventType.Response) {
                    this.isUploading = false;
                    // Update local staff object with new photo URL
                    const body: any = event.body;
                    if (body && body.photo_url) {
                        // Assuming backend returns { photo_url: ... }
                        if (this.data.staff) this.data.staff.photo_url = body.photo_url;
                        this.photoPreview = body.photo_url;
                    }
                    this.selectedFile = null;
                    this.snackBar.open('Photo uploaded successfully!', 'Close', { duration: 3000, panelClass: ['success-snackbar'] });
                    // We don't close dialog here, allowing user to see the new photo
                }
            },
            error: (err) => {
                console.error('Upload failed', err);
                this.isUploading = false;
                this.snackBar.open('Failed to upload photo', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
            }
        });
    }

    onCancel(): void {
        this.dialogRef.close(false);
    }
}
