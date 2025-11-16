import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MarksService, ExamSet, AssessmentElement } from '../../services/marks.service';
import { StudentService, Student } from '../../services/student.service';
import { SchoolService } from '../../services/school.service';
import { ClassCategorizationService } from '../../services/class-categorization.service';

interface Subject {
  subject_id: number;
  subject_name: string;
}

interface StudentReport {
  student_id: number;
  student_name: string;
  reg_number: string;
  class_name: string;
}

@Component({
  selector: 'app-quick-mark-entry',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './quick-mark-entry.component.html',
  styleUrls: ['./quick-mark-entry.component.scss']
})
export class QuickMarkEntryComponent implements OnInit {
  schoolId: number = 0;
  classes: string[] = [];
  selectedClass: string = '';
  years: number[] = [];
  selectedYear: number = new Date().getFullYear();
  
  examSets: ExamSet[] = [];
  selectedExamSetId: number | null = null;
  
  subjects: Subject[] = [];
  students: StudentReport[] = [];
  assessmentElements: AssessmentElement[] = [];
  
  // For mark entry form
  selectedStudentForEntry: StudentReport | null = null;
  selectedSubjectId: number | null = null;
  selectedElementId: number | null = null;
  markValue: number | null = null;
  selectedElement: AssessmentElement | null = null;
  
  saving = false;
  loading = false;
  loadingStudents = false;
  showMarkForm = false;

  constructor(
    private router: Router,
    private marksService: MarksService,
    private studentService: StudentService,
    private schoolService: SchoolService,
    private classCategorizationService: ClassCategorizationService,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.schoolService.getMySchool().subscribe({
      next: (school) => {
        if (school) {
          this.schoolId = school.school_id;
          this.loadClasses();
          this.generateYearsList();
          this.loadExamSets();
        }
      },
      error: (err) => console.error('Error loading school:', err)
    });
  }

  loadClasses(): void {
    try {
      const schoolType = this.schoolService.getSelectedSchoolType();
      if (schoolType) {
        this.classes = this.classCategorizationService.getClassesForSchoolType(schoolType);
      }
    } catch (err) {
      console.error('Error loading classes:', err);
      this.classes = [];
    }
  }

  generateYearsList(): void {
    const currentYear = new Date().getFullYear();
    this.years = [];
    for (let i = 0; i < 5; i++) {
      this.years.unshift(currentYear - i);
    }
  }

  loadExamSets(): void {
    this.loading = true;
    const filters: any = {};
    if (this.selectedYear) {
      filters.year = this.selectedYear;
    }
    if (this.selectedClass) {
      filters.class_level = this.selectedClass;
    }
    
    this.marksService.getExamSets(this.schoolId, filters).subscribe({
      next: (data) => {
        this.examSets = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading exam sets:', err);
        this.loading = false;
      }
    });
  }

  onClassChange(): void {
    this.loadExamSets();
    this.loadStudents();
  }

  onYearChange(): void {
    this.loadExamSets();
  }

  onExamSetChange(examSetId: number): void {
    this.selectedExamSetId = examSetId;
  }

  loadStudents(): void {
    if (!this.selectedClass) return;
    
    this.loadingStudents = true;
    this.studentService.getStudents(this.schoolId, undefined, this.selectedClass).subscribe({
      next: (result: any) => {
        this.students = result.items || [];
        this.loadingStudents = false;
      },
      error: (err: any) => {
        console.error('Error loading students:', err);
        this.students = [];
        this.loadingStudents = false;
      }
    });
  }

  openMarkEntryForm(student: StudentReport): void {
    if (!this.selectedExamSetId) {
      this.snack.open('Please select an exam set first', 'Close', { duration: 3000 });
      return;
    }
    
    this.selectedStudentForEntry = student;
    this.showMarkForm = true;
    this.selectedSubjectId = null;
    this.selectedElementId = null;
    this.markValue = null;
    this.selectedElement = null;
    
    // Load subjects and assessment elements for this exam set
    this.loadSubjectsAndElements();
  }

  closeMarkForm(): void {
    this.showMarkForm = false;
    this.selectedStudentForEntry = null;
    this.selectedSubjectId = null;
    this.selectedElementId = null;
    this.markValue = null;
    this.selectedElement = null;
  }

  loadSubjectsAndElements(): void {
    if (!this.selectedExamSetId) return;

    const filters: any = {};
    if (this.selectedYear) {
      filters.year = this.selectedYear;
    }
    if (this.selectedClass) {
      filters.class_level = this.selectedClass;
    }
    
    // Load assessment elements
    this.marksService.getAssessmentElements(this.selectedExamSetId).subscribe({
      next: (elements) => {
        this.assessmentElements = elements;
        
        // Extract unique subjects with proper mapping
        const subjectMap = new Map<number, Subject>();
        elements.forEach(el => {
          if (!subjectMap.has(el.subject_id)) {
            subjectMap.set(el.subject_id, {
              subject_id: el.subject_id,
              subject_name: el.subject_name || el.element_name.split(' - ')[0] || `Subject ${el.subject_id}`
            });
          }
        });
        this.subjects = Array.from(subjectMap.values()).sort((a, b) => a.subject_name.localeCompare(b.subject_name));
      },
      error: (err) => {
        console.error('Error loading assessment elements:', err);
        this.snack.open('Failed to load subjects', 'Close', { duration: 3000 });
      }
    });
  }

  onSubjectChange(subjectId: number): void {
    this.selectedSubjectId = subjectId;
    this.selectedElementId = null;
    this.markValue = null;
  }

  onElementChange(elementId: number): void {
    this.selectedElementId = elementId;
    this.selectedElement = this.assessmentElements.find(e => e.element_id === elementId) || null;
    this.markValue = null;
  }

  getFilteredElements(): AssessmentElement[] {
    if (!this.selectedSubjectId) {
      return [];
    }
    return this.assessmentElements.filter(e => e.subject_id === this.selectedSubjectId);
  }

  getSelectedSubjectName(): string {
    const subject = this.subjects.find(s => s.subject_id === this.selectedSubjectId);
    return subject?.subject_name || 'N/A';
  }

  saveMark(): void {
    if (!this.validateForm()) {
      this.snack.open('Please fill in all fields and ensure mark is within limits', 'Close', { duration: 3000 });
      return;
    }

    if (!this.selectedStudentForEntry) {
      this.snack.open('Student not found', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    const entry = {
      student_identifier: this.selectedStudentForEntry.reg_number,
      identifier_type: 'reg_number',
      element_id: this.selectedElementId,
      score_obtained: this.markValue
    };

    this.marksService.bulkUploadMarks(this.selectedExamSetId!, this.schoolId, [entry as any]).subscribe({
      next: (result) => {
        this.saving = false;
        this.snack.open('Mark saved successfully!', 'Close', { duration: 3000 });
        
        // Close form and reload students to refresh display
        this.closeMarkForm();
      },
      error: (err) => {
        console.error('Error saving mark:', err);
        this.snack.open('Failed to save mark', 'Close', { duration: 3000 });
        this.saving = false;
      }
    });
  }

  validateForm(): boolean {
    if (
      !this.selectedExamSetId ||
      !this.selectedSubjectId ||
      !this.selectedElementId ||
      this.markValue === null ||
      this.markValue === undefined
    ) {
      return false;
    }

    if (this.markValue < 0 || (this.selectedElement && this.markValue > this.selectedElement.max_score)) {
      return false;
    }

    return true;
  }

  goBack(): void {
    this.router.navigate(['/marks']);
  }
}
