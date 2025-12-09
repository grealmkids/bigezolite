import { Component, EventEmitter, OnInit, Output, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { Student, StudentService, StudentData } from '../../services/student.service';
import { School, SchoolService } from '../../services/school.service';
import { ClassCategorizationService, SchoolType } from '../../services/class-categorization.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { take, of } from 'rxjs';
import { switchMap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-student-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './student-modal.component.html',
  styleUrls: ['./student-modal.component.scss']
})
export class StudentModalComponent implements OnInit, OnChanges {
  @Input() student: Student | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() studentUpserted = new EventEmitter<void>();
  @Output() studentDeleted = new EventEmitter<void>();

  studentForm: FormGroup;
  errorMessage: string | null = null;
  classes: string[] = [];
  loadingClasses = false;
  isEditMode = false;
  studentStatuses: string[] = ['Active', 'Inactive', 'Expelled', 'Alumni', 'Suspended', 'Sick'];
  genders: string[] = ['Boy', 'Girl'];
  districts: string[] = [
    'Abim', 'Adjumani', 'Agago', 'Alebtong', 'Amolatar', 'Amudat', 'Amuria', 'Amuru', 'Apac', 'Arua', 'Budaka', 'Bududa', 'Bugiri', 'Bugweri', 'Bugutu', 'Buikwe', 'Bukedea', 'Bukomansimbi', 'Bukwa', 'Bulambuli', 'Buliisa', 'Bundibugyo', 'Bushenyi', 'Busia', 'Butaleja', 'Butambala', 'Buvuma', 'Buyende', 'Dokolo', 'Gomba', 'Gulu', 'Hoima', 'Ibanda', 'Iganga', 'Isingiro', 'Jinja', 'Kaabong', 'Kabale', 'Kabarole', 'Kaberamaido', 'Kalangala', 'Kaliro', 'Kalungu', 'Kampala', 'Kamuli', 'Kamwenge', 'Kanungu', 'Kapchorwa', 'Kasese', 'Katakwi', 'Kayunga', 'Kazo', 'Kibaale', 'Kiboga', 'Kibuku', 'Kisoro', 'Kitatta', 'Kitgum', 'Koboko', 'Kole', 'Kotido', 'Kumi', 'Kwania', 'Kween', 'Kyegegwa', 'Kyenjojo', 'Kyaka', 'Kyankwanzi', 'Kyotera', 'Lamwo', 'Lira', 'Luuka', 'Luwero', 'Lwengo', 'Lyantonde', 'Manafwa', 'Maracha', 'Mbarara', 'Mbale', 'Mitooma', 'Mityana', 'Moroto', 'Moyo', 'Mpigi', 'Mukono', 'Nabilatuk', 'Nakapiripirit', 'Nakaseke', 'Nakasongola', 'Namayingo', 'Namisindwa', 'Namutumba', 'Napak', 'Nebbi', 'Ngora', 'Ntoroko', 'Ntungamo', 'Nwoya', 'Omoro', 'Otuke', 'Pader', 'Pakwach', 'Pallisa', 'Rakai', 'Rubirizi', 'Rukiga', 'Rukungiri', 'Sembabule', 'Serere', 'Sheema', 'Sironko', 'Soroti', 'Tororo', 'Wakiso', 'Yumbe'
  ];

  selectedFile: File | null = null;
  previewUrl: string | null = null;
  uploadProgress: number = 0;
  isUploading: boolean = false;

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
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  constructor(
    private fb: FormBuilder,
    private studentService: StudentService,
    private schoolService: SchoolService,
    private classCategorizationService: ClassCategorizationService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.studentForm = this.fb.group({
      student_name: ['', Validators.required],
      class_name: ['', Validators.required],
      year_enrolled: [new Date().getFullYear(), Validators.required],
      student_status: ['Active', Validators.required],
      gender: ['', Validators.required],
      lin: [''],
      parent_primary_name: ['', Validators.required],
      parent_phone_sms: ['', Validators.required],
      parent_name_mother: [''],
      parent_name_father: [''],
      residence_district: ['', Validators.required],
      joining_term: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    // Populate classes dropdown based on localStorage schoolType only
    this.loadingClasses = true;
    try {
      const schoolType = this.schoolService.getSelectedSchoolType();
      if (schoolType) {
        this.classes = this.classCategorizationService.getClassesForSchoolType(schoolType);
      } else {
        this.classes = [];
      }
    } catch (err) {
      this.classes = [];
    }
    this.loadingClasses = false;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.student) {
      this.isEditMode = true;
      setTimeout(() => {
        this.studentForm.patchValue({
          student_name: this.student?.student_name || '',
          class_name: this.student?.class_name || '',
          year_enrolled: (this.student as any)?.year_enrolled || new Date().getFullYear(),
          student_status: this.student?.student_status || 'Active',
          gender: (this.student as any)?.gender || '',
          lin: (this.student as any)?.lin || '',
          parent_primary_name: (this.student as any)?.parent_primary_name || '',
          parent_phone_sms: this.student?.parent_phone_sms || '',
          parent_name_mother: (this.student as any)?.parent_name_mother || '',
          parent_name_father: (this.student as any)?.parent_name_father || '',
          residence_district: (this.student as any)?.residence_district || '',
          joining_term: (this.student as any)?.joining_term || '',
        });
        // Existing photo
        if ((this.student as any).student_photo_url) {
          this.previewUrl = (this.student as any).student_photo_url;
        } else {
          this.previewUrl = null;
        }
      }, 0);
    } else {
      this.isEditMode = false;
      this.studentForm.reset({ year_enrolled: new Date().getFullYear(), student_status: 'Active', gender: '' });
      this.previewUrl = null;
      this.selectedFile = null;
    }
  }

  onSubmit(): void {
    if (this.studentForm.invalid) {
      return;
    }

    this.errorMessage = null;
    const formValue: StudentData = this.studentForm.value;

    // For editing: use the student's own school_id. For creating: use currently selected school.
    const schoolId = this.isEditMode && this.student?.school_id
      ? this.student.school_id
      : this.schoolService.getSelectedSchoolId();

    const operation = this.isEditMode && this.student
      ? this.studentService.updateStudent(this.student.student_id, formValue, schoolId || undefined)
      : this.studentService.createStudent(formValue, schoolId || undefined);

    operation.subscribe({
      next: (created: any) => {
        const successMessage = this.isEditMode ? 'Student updated successfully!' : 'Student created successfully!';
        // If joining_term provided and it's a create, upsert presence
        if (!this.isEditMode) {
          const term = Number(this.studentForm.get('joining_term')?.value || 0);
          const year = Number(this.studentForm.get('year_enrolled')?.value || new Date().getFullYear());
          if (term && created?.student_id) {
            this.studentService.upsertStudentTerm(created.student_id, year, term, true, this.studentForm.get('student_status')?.value, this.studentForm.get('class_name')?.value)
              .pipe(take(1)).subscribe({ next: () => { }, error: () => { } });
          }
        }

        // Handle File Upload for NEW students (chained)
        if (!this.isEditMode && this.selectedFile && this.canUploadPhoto && created?.student_id) {
          this.isUploading = true;
          this.studentService.uploadStudentPhoto(created.student_id, this.selectedFile).subscribe({
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
                this.studentUpserted.emit();
                this.close.emit();
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
              this.studentUpserted.emit();
              this.close.emit();
            }
          });
        } else {
          // For Edit mode, we rely on the separate "Upload New" button, or if no file selected
          this.snackBar.open(successMessage, 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar'],
            verticalPosition: 'top',
            horizontalPosition: 'center'
          });
          this.studentUpserted.emit();
          this.close.emit();
        }
      },
      error: (err) => {
        this.errorMessage = `Failed to ${this.isEditMode ? 'update' : 'create'} student. Please try again.`;
        console.error(err);
      }
    });
  }

  uploadPhoto(): void {
    if (!this.selectedFile || !this.student) return;

    this.isUploading = true;
    this.studentService.uploadStudentPhoto(this.student.student_id, this.selectedFile).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.uploadProgress = Math.round(100 * event.loaded / event.total);
        } else if (event.type === HttpEventType.Response) {
          this.isUploading = false;
          // Update local student object with new photo URL
          if (this.student) {
            // We need to know the property name returned by backend. Usually it returns the updated student or file info.
            // Assuming event.body contains { student_photo_url: '...' } or similar.
            // Based on SchoolEditModal, it returns { badge_url: ... }
            // Let's assume backend returns { student_photo_url: ... }
            const body: any = event.body;
            if (body && body.student_photo_url) {
              (this.student as any).student_photo_url = body.student_photo_url;
              this.previewUrl = body.student_photo_url;
            }
          }
          this.selectedFile = null;
          this.snackBar.open('Photo uploaded successfully!', 'Close', { duration: 3000, panelClass: ['success-snackbar'] });
          this.studentUpserted.emit();
        }
      },
      error: (err) => {
        console.error('Upload failed', err);
        this.isUploading = false;
        this.snackBar.open('Failed to upload photo', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
      }
    });
  }

  deletePhoto(): void {
    if (!this.student) return;
    if (!confirm('Are you sure you want to remove the photo?')) return;

    // We can use updateStudent to set photo_url to null/empty
    const schoolId = this.student.school_id || this.schoolService.getSelectedSchoolId();
    this.studentService.updateStudent(this.student.student_id, { student_photo_url: '' } as any, schoolId || undefined).subscribe({
      next: (updated) => {
        this.student = updated;
        this.previewUrl = null;
        this.snackBar.open('Photo removed successfully!', 'Close', { duration: 3000, panelClass: ['success-snackbar'] });
        this.studentUpserted.emit();
      },
      error: (err) => {
        console.error('Failed to delete photo', err);
        this.snackBar.open('Failed to remove photo', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
      }
    });
  }

  onDelete(): void {
    if (!this.student) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Student',
        message: `Are you sure you want to permanently delete ${this.student.student_name}? This will remove all associated fee records and cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        danger: true
      },
      width: '420px'
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      const schoolId = this.student!.school_id || this.schoolService.getSelectedSchoolId();

      console.log('[StudentModal] Confirmed delete for studentId=', this.student!.student_id, 'schoolId=', schoolId);
      this.studentService.deleteStudent(this.student!.student_id, schoolId || undefined).subscribe({
        next: () => {
          this.snackBar.open('Student deleted successfully!', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar'],
            verticalPosition: 'top',
            horizontalPosition: 'center'
          });
          this.studentDeleted.emit();
          this.close.emit();
        },
        error: (err) => {
          const msg = err?.error?.message || 'Failed to delete student. Please try again.';
          this.snackBar.open(msg, 'Close', {
            duration: 3000,
            panelClass: ['error-snackbar'],
            verticalPosition: 'top',
            horizontalPosition: 'center'
          });
          console.error('Delete error:', err);
        }
      });
    });
  }
}
