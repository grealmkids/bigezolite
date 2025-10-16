import { Component, EventEmitter, OnInit, Output, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Student, StudentService, StudentData } from '../../services/student.service';
import { SchoolService } from '../../services/school.service';
import { ClassCategorizationService, SchoolType } from '../../services/class-categorization.service';
import { take, of } from 'rxjs';
import { switchMap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { School } from '../../services/school.service';

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
  loadingClasses = false;
  isEditMode = false;
  districts: string[] = [
    'Abim','Adjumani','Agago','Alebtong','Amolatar','Amudat','Amuria','Amuru','Apac','Arua','Budaka','Bududa','Bugiri','Bugweri','Bugutu','Buikwe','Bukedea','Bukomansimbi','Bukwa','Bulambuli','Buliisa','Bundibugyo','Bushenyi','Busia','Butaleja','Butambala','Buvuma','Buyende','Dokolo','Gomba','Gulu','Hoima','Ibanda','Iganga','Isingiro','Jinja','Kaabong','Kabale','Kabarole','Kaberamaido','Kalangala','Kaliro','Kalungu','Kampala','Kamuli','Kamwenge','Kanungu','Kapchorwa','Kasese','Katakwi','Kayunga','Kazo','Kibaale','Kiboga','Kibuku','Kisoro','Kitatta','Kitgum','Koboko','Kole','Kotido','Kumi','Kwania','Kween','Kyegegwa','Kyenjojo','Kyaka','Kyankwanzi','Kyotera','Lamwo','Lira','Luuka','Luwero','Lwengo','Lyantonde','Manafwa','Maracha','Mbarara','Mbale','Mitooma','Mityana','Moroto','Moyo','Mpigi','Mukono','Nabilatuk','Nakapiripirit','Nakaseke','Nakasongola','Namayingo','Namisindwa','Namutumba','Napak','Nebbi','Ngora','Ntoroko','Ntungamo','Nwoya','Omoro','Otuke','Pader','Pakwach','Pallisa','Rakai','Rubirizi','Rukiga','Rukungiri','Sembabule','Serere','Sheema','Sironko','Soroti','Tororo','Wakiso','Yumbe'
  ];

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