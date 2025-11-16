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

interface StudentMarkRow {
  student_id: number;
  student_name: string;
  reg_number: string;
  marks: { [subjectId: number]: number | null };
  marksDirty: { [subjectId: number]: boolean };
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
  selectedExamSetId: number | null = null;
  
  examSets: ExamSet[] = [];
  subjects: Subject[] = [];
  students: StudentMarkRow[] = [];
  
  loading = false;
  saving = false;
  hasChanges = false;

  constructor(
    private router: Router,
    private marksService: MarksService,
    private studentService: StudentService,
    private schoolService: SchoolService,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.schoolService.getMySchool().subscribe({
      next: (school) => {
        if (school) {
          this.schoolId = school.school_id;
          this.loadExamSets();
        }
      },
      error: (err) => console.error('Error loading school:', err)
    });
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
    this.loadSubjectsAndStudents();
  }

  loadSubjectsAndStudents(): void {
    if (!this.selectedExamSetId) return;

    this.loading = true;
    
    // Load subjects
    this.marksService.getAssessmentElements(this.selectedExamSetId).subscribe({
      next: (elements) => {
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
        const items = Array.isArray(response) ? response : (response as any).items || [];
        this.students = items.map((student: any) => ({
          student_id: student.student_id,
          student_name: student.student_name,
          reg_number: student.reg_number,
          marks: {},
          marksDirty: {}
        }));
        
        // Load existing marks
        this.loadExistingMarks();
      },
      error: (err) => {
        console.error('Error loading students:', err);
        this.snack.open('Failed to load students', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  loadExistingMarks(): void {
    if (!this.selectedExamSetId) {
      this.loading = false;
      return;
    }

    this.marksService.getExamSetResults(this.selectedExamSetId).subscribe({
      next: (results) => {
        // Populate marks from results
        results.forEach((result: any) => {
          const student = this.students.find(s => s.student_id === result.student_id);
          if (student) {
            student.marks[result.subject_id] = result.total_score;
          }
        });
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading marks:', err);
        // Continue even if no marks found
        this.loading = false;
      }
    });
  }

  onMarkChange(studentId: number, subjectId: number): void {
    const student = this.students.find(s => s.student_id === studentId);
    if (student) {
      student.marksDirty[subjectId] = true;
      this.hasChanges = true;
    }
  }

  saveAllMarks(): void {
    if (!this.selectedExamSetId) {
      this.snack.open('Please select an exam set', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    const entries = [];

    for (const student of this.students) {
      for (const subjectId in student.marksDirty) {
        if (student.marksDirty[subjectId] && student.marks[subjectId] !== null && student.marks[subjectId] !== undefined) {
          entries.push({
            student_identifier: student.reg_number,
            identifier_type: 'reg_number',
            subject_id: parseInt(subjectId),
            score_obtained: student.marks[subjectId]
          });
        }
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
          s.marksDirty = {};
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
    const student = this.students.find(s => s.student_id === studentId);
    if (student && this.selectedExamSetId) {
      this.router.navigate(['/marks/student-report', this.selectedExamSetId, studentId]);
    }
  }

  goBack(): void {
    this.router.navigate(['/marks']);
  }
}
