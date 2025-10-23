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
  private sortColumn = new BehaviorSubject<string>('student_name');
  private sortDirection = new BehaviorSubject<'ASC' | 'DESC'>('ASC');

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
    // Reset to first page whenever filters/search changes
    this.pageEvent.pageIndex = 0;
    this.pageIndex.next(0);
    this.searchTerms.next(term);
  }

  onClassChange(term: string): void {
    // Ensure string type and handle empty string
    this.pageEvent.pageIndex = 0;
    this.pageIndex.next(0);
    this.classFilter.next(term ? String(term) : '');
  }

  onStatusChange(term: string): void {
    this.pageEvent.pageIndex = 0;
    this.pageIndex.next(0);
    this.statusFilter.next(term);
  }

  onYearChange(term: string): void {
    this.pageEvent.pageIndex = 0;
    this.pageIndex.next(0);
    this.yearFilter.next(term);
  }

  onPageChange(event: PageEvent): void {
    this.pageEvent = event;
    this.pageIndex.next(event.pageIndex);
    this.pageSize.next(event.pageSize);
  }

  onSort(column: string): void {
    if (this.sortColumn.value === column) {
      // Toggle direction
      this.sortDirection.next(this.sortDirection.value === 'ASC' ? 'DESC' : 'ASC');
    } else {
      // Set new column, default to ASC
      this.sortColumn.next(column);
      this.sortDirection.next('ASC');
    }
    // Reset to first page
    this.pageIndex.next(0);
  }

  // Helper methods for template-driven pagination controls
  get totalPages(): number {
    const length = this.pageEvent.length || 0;
    const size = this.pageEvent.pageSize || 10;
    return Math.max(1, Math.ceil(length / size));
  }

  prevPage(): void {
    if (this.pageEvent.pageIndex > 0) {
      const newIndex = this.pageEvent.pageIndex - 1;
      this.pageEvent.pageIndex = newIndex;
      this.pageIndex.next(newIndex);
    }
  }

  nextPage(): void {
    const maxPageIndex = Math.max(0, this.totalPages - 1);
    if (this.pageEvent.pageIndex < maxPageIndex) {
      const newIndex = this.pageEvent.pageIndex + 1;
      this.pageEvent.pageIndex = newIndex;
      this.pageIndex.next(newIndex);
    }
  }

  changePageSize(size: number): void {
    this.pageEvent.pageSize = size;
    this.pageEvent.pageIndex = 0;
    this.pageSize.next(size);
    this.pageIndex.next(0);
  }

  ngOnInit(): void {
    this.loadingClasses = true;
    try {
      const schoolType = this.schoolService.getSelectedSchoolType();
      this.classes = schoolType ? this.classCategorizationService.getClassesForSchoolType(schoolType) : [];
    } catch (err) {
      this.classes = [];
    } finally {
      this.loadingClasses = false;
    }

    this.students$ = combineLatest([
      this.searchTerms.pipe(debounceTime(300), distinctUntilChanged(), startWith('')),
      this.classFilter.pipe(distinctUntilChanged(), startWith('')),
      this.statusFilter.pipe(distinctUntilChanged(), startWith('')),
      this.yearFilter.pipe(distinctUntilChanged(), startWith('')),
      this.pageIndex.pipe(distinctUntilChanged(), startWith(0)),
      this.pageSize.pipe(distinctUntilChanged(), startWith(10)),
      this.sortColumn.pipe(distinctUntilChanged(), startWith('student_name')),
      this.sortDirection.pipe(distinctUntilChanged(), startWith('ASC'))
    ]).pipe(
      switchMap(([searchTerm, classTerm, statusTerm, yearTerm, page, limit, sort, order]) => {
        this.isLoading = true;
        return this.studentService.getStudents(searchTerm, classTerm, statusTerm, yearTerm, page, limit, sort, order);
      })
    );

    this.students$.subscribe({
      next: (resp) => {
        this.displayedStudents = resp.items || [];
        this.pageEvent.length = resp.total;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err?.error?.message || 'Failed to load students';
        this.snack.open(msg, 'OK', { duration: 5000 });
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