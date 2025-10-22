import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'noDash' })
export class NoDashPipe implements PipeTransform {
  transform(value: string): string {
    return value ? value.split('-').join('') : '';
  }
}
import { Component, OnInit } from '@angular/core';
import { LoadingService } from '../../services/loading.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Observable, Subject, combineLatest, BehaviorSubject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, startWith, take, map } from 'rxjs/operators';
import { Student, StudentService } from '../../services/student.service';
import { CommonModule } from '@angular/common';
import { StudentModalComponent } from '../../components/student-modal/student-modal.component';
import { FeesManagementModalComponent } from '../../components/fees-management-modal/fees-management-modal.component';
import { SmsStudentModalComponent } from '../../components/sms-student-modal/sms-student-modal.component';
import { SchoolService } from '../../services/school.service';
import { ClassCategorizationService, SchoolType } from '../../services/class-categorization.service';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-student-management',
  standalone: true,
  imports: [
    CommonModule,
    StudentModalComponent,
    FeesManagementModalComponent,
    SmsStudentModalComponent,
    LoadingSpinnerComponent,
    MatPaginatorModule,
    NoDashPipe
  ],
  templateUrl: './student-management.component.html',
  styleUrls: ['./student-management.component.scss']
})
export class StudentManagementComponent implements OnInit {
  students$: Observable<{ items: Student[]; total: number }> | undefined;
  displayedStudents: Student[] = [];
  isLoading = false;
  private searchTerms = new Subject<string>();
  private classFilter = new BehaviorSubject<string>('');
  private statusFilter = new BehaviorSubject<string>('');
  private yearFilter = new BehaviorSubject<string>('');
  private pageIndex = new BehaviorSubject<number>(0);
  private pageSize = new BehaviorSubject<number>(10);

  // Pagination settings
  pageEvent: PageEvent = {
    pageIndex: 0,
    pageSize: 10,
    length: 0
  };

  isStudentModalOpen = false;
  isFeesModalOpen = false;
  isSmsModalOpen = false;
  selectedStudent: Student | null = null;

  classes: string[] = [];
  years = ['2023', '2024', '2025']; // This can also be dynamic
  loadingClasses = false;

  constructor(
  private studentService: StudentService,
  private schoolService: SchoolService,
  private classCategorizationService: ClassCategorizationService,
  private loadingService: LoadingService,
  private snack: MatSnackBar
  ) { }

  onSearch(term: string): void {
    this.searchTerms.next(term);
  }

  onClassChange(term: string): void {
    // Ensure string type and handle empty string
    this.classFilter.next(term ? String(term) : '');
  }

  onStatusChange(term: string): void {
    this.statusFilter.next(term);
  }

  onYearChange(term: string): void {
    this.yearFilter.next(term);
  }

  onPageChange(event: PageEvent): void {
    this.pageEvent = event;
    this.pageIndex.next(event.pageIndex);
    this.pageSize.next(event.pageSize);
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
      
    // Initialize the students$ observable with pagination
    this.students$ = combineLatest([
      this.searchTerms.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        startWith('')
      ),
      this.classFilter.pipe(startWith('')),
      this.statusFilter.pipe(startWith('')),
      this.yearFilter.pipe(startWith('')),
      this.pageIndex.pipe(startWith(0)),
      this.pageSize.pipe(startWith(10))
    ]).pipe(
      switchMap(([search, classFilter, status, year, page, limit]) =>
        this.studentService.getStudents(search, classFilter, status, year, page, limit)
      ),
      map(response => {
        // Update the page length
        this.pageEvent.length = response.total;
        return response;
      })
    );
    } catch (err) {
      this.classes = [];
    }
    this.loadingClasses = false;

    // Load all students by default and apply filters
    const filters$ = combineLatest([
      this.searchTerms.pipe(startWith('')),
      this.classFilter.pipe(startWith('')),
      this.statusFilter.pipe(startWith('')),
      this.yearFilter.pipe(startWith(''))
    ]);

    this.students$ = filters$.pipe(
      debounceTime(300),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      switchMap(([searchTerm, classTerm, statusTerm, yearTerm]) => {
        this.isLoading = true;
        // Use component-local loading flag (do not rely solely on global interceptor)
        return this.studentService.getStudents(searchTerm, classTerm, statusTerm, yearTerm);
      })
    );
    // Hide spinner when students$ emits
    this.students$.subscribe({
      next: () => {
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err?.error?.message || err?.message || 'Failed to load students';
        this.snack.open(msg, 'OK', { duration: 5000, panelClass: ['sms-balance-snackbar'] });
      }
    });
  }

  // Student Modal Methods
  openStudentModal(student: Student | null = null): void {
    if (student && student.student_id) {
      this.studentService.getStudentById(student.student_id)
        .subscribe(fullStudent => {
          console.log('[Edit Modal] fetched student:', fullStudent);
          this.selectedStudent = fullStudent || student;
          this.isStudentModalOpen = true;
        });
    } else {
      this.selectedStudent = null;
      this.isStudentModalOpen = true;
    }
  }

  closeStudentModal(): void {
    this.isStudentModalOpen = false;
    this.selectedStudent = null;
  }

  onStudentUpserted(): void {
    this.closeStudentModal();
    setTimeout(() => {
      this.searchTerms.next(''); // Refresh the list after modal closes
    }, 100);
  }

  // Fees Management Modal Methods
  openFeesModal(student: Student): void {
    if (student && student.student_id) {
      this.studentService.getStudentById(student.student_id)
        .subscribe(fullStudent => {
          console.log('[Fees Modal] fetched student:', fullStudent);
          this.selectedStudent = fullStudent || student;
          this.isFeesModalOpen = true;
        });
    } else {
      this.selectedStudent = null;
      this.isFeesModalOpen = true;
    }
  }

  closeFeesModal(): void {
    this.isFeesModalOpen = false;
    this.selectedStudent = null;
  }

  // SMS Modal Methods
  openSmsModal(student: Student): void {
    if (student && student.student_id) {
      this.studentService.getStudentById(student.student_id)
        .subscribe(fullStudent => {
          console.log('[SMS Modal] fetched student:', fullStudent);
          this.selectedStudent = fullStudent || student;
          this.isSmsModalOpen = true;
        });
    } else {
      this.selectedStudent = null;
      this.isSmsModalOpen = true;
    }
  }

  closeSmsModal(): void {
    this.isSmsModalOpen = false;
    this.selectedStudent = null;
  }

  // Delete Method
  deleteStudent(studentId: number): void {
    if (confirm('Are you sure you want to mark this student as inactive?')) {
      this.studentService.deleteStudent(studentId).subscribe(() => {
        this.searchTerms.next(''); // Refresh the list
      });
    }
  }
}