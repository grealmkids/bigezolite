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

interface StudentMarkRow {
  student_id: number;
  student_name: string;
  reg_number: string;
  mark: number | null;
  markDirty: boolean;
}

@Component({
  selector: 'app-student-marks-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './student-marks-viewer.component.html',
  styleUrls: ['./student-marks-viewer.component.scss']
})
export class StudentMarksViewerComponent implements OnInit {
  schoolId: number = 0;

  // Filters
  classes: string[] = [];
  selectedClass: string = '';
  years: number[] = [];
  selectedYear: number = new Date().getFullYear();

  examSets: ExamSet[] = [];
  selectedExamSetId: number | null = null;

  subjects: Subject[] = [];
  selectedSubjectId: number | null = null;

  assessmentElements: AssessmentElement[] = [];
  filteredElements: AssessmentElement[] = [];
  selectedElementId: number | null = null;
  selectedElement: AssessmentElement | null = null;

  // Data
  students: StudentMarkRow[] = [];

  loading = false;
  saving = false;
  hasChanges = false;

  constructor(
    private router: Router,
    private marksService: MarksService,
    private studentService: StudentService,
    private schoolService: SchoolService,
    private classCategorizationService: ClassCategorizationService,
    private snack: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.schoolService.getMySchool().subscribe({
      next: (school) => {
        if (school) {
          this.schoolId = school.school_id;
          this.loadClasses();
          this.generateYearsList();
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

  onClassChange(): void {
    this.selectedExamSetId = null;
    this.selectedSubjectId = null;
    this.selectedElementId = null;
    this.examSets = [];
    this.subjects = [];
    this.filteredElements = [];
    this.students = [];

    if (this.selectedClass) {
      this.loadExamSets();
    }
  }

  onYearChange(): void {
    this.selectedExamSetId = null;
    this.selectedSubjectId = null;
    this.selectedElementId = null;
    this.examSets = [];
    this.subjects = [];
    this.filteredElements = [];
    this.students = [];

    if (this.selectedClass) {
      this.loadExamSets();
    }
  }

  loadExamSets(): void {
    this.loading = true;
    const filters: any = {
      class_level: this.selectedClass,
      year: this.selectedYear
    };

    this.marksService.getExamSets(this.schoolId, filters).subscribe({
      next: (data) => {
        this.examSets = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading exam sets:', err);
        this.snack.open('Failed to load exam sets', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  onExamSetChange(examSetId: number): void {
    this.selectedExamSetId = examSetId;
    this.selectedSubjectId = null;
    this.selectedElementId = null;
    this.subjects = [];
    this.filteredElements = [];
    this.students = [];

    if (examSetId) {
      this.loadSubjectsAndElements();
    }
  }

  loadSubjectsAndElements(): void {
    if (!this.selectedExamSetId) return;

    this.loading = true;
    this.marksService.getAssessmentElements(this.selectedExamSetId).subscribe({
      next: (elements) => {
        this.assessmentElements = elements;

        // Group elements by subject
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
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading assessment elements:', err);
        this.snack.open('Failed to load subjects', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  onSubjectChange(subjectId: number): void {
    this.selectedSubjectId = subjectId;
    this.selectedElementId = null;
    this.students = [];

    if (subjectId) {
      this.filteredElements = this.assessmentElements.filter(e => e.subject_id == subjectId);
    } else {
      this.filteredElements = [];
    }
  }

  onElementChange(elementId: number): void {
    this.selectedElementId = elementId;
    this.selectedElement = this.assessmentElements.find(e => e.element_id == elementId) || null;

    if (elementId) {
      this.loadStudentsAndMarks();
    } else {
      this.students = [];
    }
  }

  loadStudentsAndMarks(): void {
    if (!this.selectedClass || !this.selectedExamSetId || !this.selectedElementId) return;

    this.loading = true;

    // Load students
    this.studentService.getStudents(this.schoolId, undefined, this.selectedClass).subscribe({
      next: (response) => {
        const items = Array.isArray(response) ? response : (response as any).items || [];

        // Initialize students with empty marks
        this.students = items.map((student: any) => ({
          student_id: student.student_id,
          student_name: student.student_name,
          reg_number: student.reg_number,
          mark: null,
          markDirty: false
        }));

        // Load existing marks for this exam set
        this.marksService.getExamSetResults(this.selectedExamSetId!).subscribe({
          next: (results) => {
            results.forEach((result: any) => {
              // Filter for the selected element
              // Note: getExamSetResults returns aggregated subject marks usually, 
              // but we need element-level marks. 
              // Wait, getExamSetResults returns `results_exam_entries` joined with `results_entry`.
              // We need to check if `results_entry` has `element_id`.
              // Let's assume we need to filter by element_id if available, or fetch specific element marks.
              // Actually, the current `getExamSetResults` might be returning subject totals.
              // Let's check `getMarksByStudent` or similar.
              // `getExamSetResults` in `marks.service.ts` calls `/exam-sets/:examSetId/results`.
              // Let's use `getExamSetResults` and filter client side if it returns all entries.

              // If the API returns all individual mark entries:
              if (result.element_id == this.selectedElementId) {
                const student = this.students.find(s => s.student_id === result.student_id);
                if (student) {
                  student.mark = result.score_obtained;
                }
              }
            });
            this.loading = false;
          },
          error: (err) => {
            console.error('Error loading marks:', err);
            this.loading = false;
          }
        });
      },
      error: (err) => {
        console.error('Error loading students:', err);
        this.snack.open('Failed to load students', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  onMarkChange(student: StudentMarkRow): void {
    student.markDirty = true;
    this.hasChanges = true;
  }

  saveAllMarks(): void {
    if (!this.selectedExamSetId || !this.selectedElementId) {
      this.snack.open('Please select an exam set and element', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    const entries = [];

    for (const student of this.students) {
      if (student.markDirty && student.mark !== null && student.mark !== undefined) {
        entries.push({
          student_identifier: student.reg_number,
          identifier_type: 'reg_number',
          element_id: this.selectedElementId,
          score_obtained: student.mark
        });
      }
    }

    if (entries.length === 0) {
      this.snack.open('No changes to save', 'Close', { duration: 3000 });
      this.saving = false;
      return;
    }

    this.marksService.bulkUploadMarks(this.selectedExamSetId, this.schoolId, entries as any).subscribe({
      next: (result) => {
        this.saving = false;
        this.hasChanges = false;
        this.snack.open(`Marks saved! ${result.success} records processed.`, 'Close', { duration: 3000 });

        // Reset dirty flags
        this.students.forEach(s => {
          s.markDirty = false;
        });
      },
      error: (err) => {
        console.error('Error saving marks:', err);
        this.snack.open('Failed to save marks', 'Close', { duration: 3000 });
        this.saving = false;
      }
    });
  }

  generateStudentReport(studentId: number): void {
    if (this.selectedExamSetId) {
      this.router.navigate(['/marks/student-report', this.selectedExamSetId, studentId]);
    }
  }

  goBack(): void {
    this.router.navigate(['/marks']);
  }
}
