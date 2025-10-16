import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'noDash' })
export class NoDashPipe implements PipeTransform {
  transform(value: string): string {
    return value ? value.split('-').join('') : '';
  }
}
import { Component, OnInit } from '@angular/core';
import { LoadingService } from '../../services/loading.service';
import { Observable, Subject, combineLatest, BehaviorSubject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, startWith, take } from 'rxjs/operators';
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
  imports: [CommonModule, StudentModalComponent, FeesManagementModalComponent, SmsStudentModalComponent, LoadingSpinnerComponent, NoDashPipe],
  templateUrl: './student-management.component.html',
  styleUrl: './student-management.component.scss'
})
export class StudentManagementComponent implements OnInit {
  students$: Observable<Student[]> | undefined;
  isLoading = false;
  private searchTerms = new Subject<string>();
  private classFilter = new BehaviorSubject<string>('');
  private statusFilter = new BehaviorSubject<string>('');
  private yearFilter = new BehaviorSubject<string>('');

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
  private loadingService: LoadingService
  ) { }

  onSearch(term: string): void {
    this.searchTerms.next(term);
  }

  onClassChange(term: string): void {
    this.classFilter.next(term);
  }

  onStatusChange(term: string): void {
    this.statusFilter.next(term);
  }

  onYearChange(term: string): void {
    this.yearFilter.next(term);
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

    // ...existing code for filters and students$...
    const filters$ = combineLatest([
      this.searchTerms.pipe(startWith('')),
      this.classFilter,
      this.statusFilter,
      this.yearFilter
    ]);

    this.students$ = filters$.pipe(
      debounceTime(300),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      switchMap(([searchTerm, classTerm, statusTerm, yearTerm]) => {
        this.isLoading = true;
        this.loadingService.show();
        return this.studentService.getStudents(searchTerm, classTerm, statusTerm, yearTerm);
      })
    );
    // Hide spinner when students$ emits
    this.students$.subscribe({
      next: () => {
        this.isLoading = false;
        this.loadingService.hide();
      },
      error: () => {
        this.isLoading = false;
        this.loadingService.hide();
      }
    });
  }

  // Student Modal Methods
  openStudentModal(student: Student | null = null): void {
    this.selectedStudent = student;
    this.isStudentModalOpen = true;
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
    this.selectedStudent = student;
    this.isFeesModalOpen = true;
  }

  closeFeesModal(): void {
    this.isFeesModalOpen = false;
    this.selectedStudent = null;
  }

  // SMS Modal Methods
  openSmsModal(student: Student): void {
    this.selectedStudent = student;
    this.isSmsModalOpen = true;
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