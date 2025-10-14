import { Component, EventEmitter, OnInit, Output, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Student, StudentService, StudentData } from '../../services/student.service';
import { SchoolService } from '../../services/school.service';
import { ClassCategorizationService, SchoolType } from '../../services/class-categorization.service';
import { take } from 'rxjs';

@Component({
  selector: 'app-student-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './student-modal.component.html',
  styleUrl: './student-modal.component.scss'
})
export class StudentModalComponent implements OnInit, OnChanges {
  @Input() student: Student | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() studentUpserted = new EventEmitter<void>();

  studentForm: FormGroup;
  errorMessage: string | null = null;
  classes: string[] = [];
  isEditMode = false;

  constructor(
    private fb: FormBuilder, 
    private studentService: StudentService,
    private schoolService: SchoolService,
    private classCategorizationService: ClassCategorizationService
    ) {
    this.studentForm = this.fb.group({
      student_name: ['', Validators.required],
      class_name: ['', Validators.required],
      year_enrolled: [new Date().getFullYear(), Validators.required],
      student_status: ['Active', Validators.required],
      parent_primary_name: ['', Validators.required],
      parent_phone_sms: ['', Validators.required],
      parent_name_mother: [''],
      parent_name_father: [''],
      residence_district: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.schoolService.getMySchool().pipe(take(1)).subscribe(school => {
      if (school) {
        this.classes = this.classCategorizationService.getClassesForSchoolType(school.school_type as SchoolType);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['student'] && this.student) {
      this.isEditMode = true;
      this.studentForm.patchValue(this.student);
    } else {
      this.isEditMode = false;
      this.studentForm.reset({ year_enrolled: new Date().getFullYear(), student_status: 'Active' });
    }
  }

  onSubmit(): void {
    if (this.studentForm.invalid) {
      return;
    }

    this.errorMessage = null;
    const formValue: StudentData = this.studentForm.value;

    const operation = this.isEditMode && this.student
      ? this.studentService.updateStudent(this.student.student_id, formValue)
      : this.studentService.createStudent(formValue);

    operation.subscribe({
      next: () => {
        this.studentUpserted.emit();
        this.close.emit();
      },
      error: (err) => {
        this.errorMessage = `Failed to ${this.isEditMode ? 'update' : 'create'} student. Please try again.`;
        console.error(err);
      }
    });
  }
}