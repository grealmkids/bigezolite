import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MarksService, ExamSet, AssessmentElement } from '../../services/marks.service';
import { StudentService, Student } from '../../services/student.service';
import { SchoolService } from '../../services/school.service';

interface Subject {
  subject_id: number;
  subject_name: string;
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
  
  examSets: ExamSet[] = [];
  subjects: Subject[] = [];
  students: Student[] = [];
  assessmentElements: AssessmentElement[] = [];
  
  selectedExamSetId: number | null = null;
  selectedSubjectId: number | null = null;
  selectedStudentId: number | null = null;
  selectedElementId: number | null = null;
  
  markValue: number | null = null;
  selectedElement: AssessmentElement | null = null;
  
  saving = false;
  loading = false;

  constructor(
    private router: Router,
    private marksService: MarksService,
    private studentService: StudentService,
    private schoolService: SchoolService,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    const storedSchoolId = localStorage.getItem('currentSchoolId');
    if (storedSchoolId) {
      this.schoolId = parseInt(storedSchoolId);
      this.loadExamSets();
    }
  }

  loadExamSets(): void {
    this.loading = true;
    this.marksService.getExamSets(this.schoolId).subscribe({
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
    this.selectedStudentId = null;
    this.selectedElementId = null;
    this.markValue = null;
    this.loadSubjectsAndStudents();
  }

  loadSubjectsAndStudents(): void {
    if (!this.selectedExamSetId) return;

    this.loading = true;
    
    // Load assessment elements
    this.marksService.getAssessmentElements(this.selectedExamSetId).subscribe({
      next: (elements) => {
        this.assessmentElements = elements;
        
        // Group elements by subject
        const subjectMap = new Map<number, Subject>();
        elements.forEach(el => {
          if (!subjectMap.has(el.subject_id)) {
            subjectMap.set(el.subject_id, {
              subject_id: el.subject_id,
              subject_name: el.element_name.split(' - ')[0] || `Subject ${el.subject_id}`
            });
          }
        });
        this.subjects = Array.from(subjectMap.values());
        
        // Load students
        const examSet = this.examSets.find(es => es.exam_set_id === this.selectedExamSetId);
        if (examSet) {
          this.loadStudentsForClass(examSet.class_level);
        }
      },
      error: (err) => {
        console.error('Error loading assessment elements:', err);
        this.snack.open('Failed to load subjects', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  loadStudentsForClass(classLevel: string): void {
    this.studentService.getStudents(this.schoolId, classLevel).subscribe({
      next: (response) => {
        this.students = Array.isArray(response) ? response : (response as any).items || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading students:', err);
        this.snack.open('Failed to load students', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  onSubjectChange(subjectId: number): void {
    this.selectedSubjectId = subjectId;
    this.selectedElementId = null;
    this.markValue = null;
  }

  onStudentChange(studentId: number): void {
    this.selectedStudentId = studentId;
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

  saveMark(): void {
    if (!this.validateForm()) {
      this.snack.open('Please fill in all fields and ensure mark is within limits', 'Close', { duration: 3000 });
      return;
    }

    const student = this.students.find(s => s.student_id === this.selectedStudentId);
    if (!student) {
      this.snack.open('Student not found', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    const entry = {
      student_identifier: student.reg_number,
      identifier_type: 'reg_number',
      element_id: this.selectedElementId,
      score_obtained: this.markValue
    };

    this.marksService.bulkUploadMarks(this.selectedExamSetId!, this.schoolId, [entry as any]).subscribe({
      next: (result) => {
        this.saving = false;
        this.snack.open('Mark saved successfully!', 'Close', { duration: 3000 });
        
        // Reset form
        this.selectedSubjectId = null;
        this.selectedStudentId = null;
        this.selectedElementId = null;
        this.markValue = null;
        this.selectedElement = null;
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
      !this.selectedStudentId ||
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
