import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MarksService, ExamSet, AssessmentElement } from '../../services/marks.service';
import { StudentService, Student } from '../../services/student.service';

interface StudentMark {
  student_id: number;
  student_name: string;
  reg_number: string;
  marks: { [elementId: number]: number };
}

@Component({
  selector: 'app-enter-marks',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './enter-marks.component.html',
  styleUrls: ['./enter-marks.component.scss']
})
export class EnterMarksComponent implements OnInit {
  schoolId: number = 0;
  examSetId: number = 0;
  examSet: ExamSet | null = null;
  assessmentElements: AssessmentElement[] = [];
  students: StudentMark[] = [];
  
  loading = false;
  saving = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private marksService: MarksService,
    private studentService: StudentService,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    const storedSchoolId = localStorage.getItem('currentSchoolId');
    if (storedSchoolId) {
      this.schoolId = parseInt(storedSchoolId);
    }

    this.route.params.subscribe(params => {
      this.examSetId = parseInt(params['examSetId']);
      if (this.examSetId) {
        this.loadExamSet();
        this.loadAssessmentElements();
        this.loadStudents();
      }
    });
  }

  loadExamSet(): void {
    this.loading = true;
    this.marksService.getExamSetById(this.examSetId).subscribe({
      next: (data) => {
        this.examSet = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading exam set:', err);
        this.snack.open('Failed to load exam set', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  loadAssessmentElements(): void {
    this.marksService.getAssessmentElements(this.examSetId).subscribe({
      next: (data) => {
        this.assessmentElements = data;
      },
      error: (err) => {
        console.error('Error loading assessment elements:', err);
        this.snack.open('Failed to load assessment elements', 'Close', { duration: 3000 });
      }
    });
  }

  loadStudents(): void {
    const classLevel = this.examSet?.class_level || '';
    this.studentService.getStudents(this.schoolId, classLevel).subscribe({
      next: (response) => {
        const items = Array.isArray(response) ? response : (response as any).items || [];
        this.students = items.map((student: any) => ({
          student_id: student.student_id,
          student_name: student.student_name,
          reg_number: student.reg_number,
          marks: {}
        }));
      },
      error: (err) => {
        console.error('Error loading students:', err);
        this.snack.open('Failed to load students', 'Close', { duration: 3000 });
      }
    });
  }

  saveMarks(): void {
    if (!this.validateMarks()) {
      this.snack.open('Please fill in all marks or ensure scores are within limits', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    const entries = this.students.flatMap(student =>
      this.assessmentElements
        .filter(el => student.marks[el.element_id] !== undefined && student.marks[el.element_id] !== null)
        .map(el => ({
          student_identifier: student.reg_number,
          identifier_type: 'reg_number',
          element_id: el.element_id,
          score_obtained: student.marks[el.element_id]
        }))
    );

    this.marksService.bulkUploadMarks(this.examSetId, this.schoolId, entries as any).subscribe({
      next: (result) => {
        this.saving = false;
        this.snack.open(`Marks saved! ${result.success} records processed.`, 'Close', { duration: 3000 });
        setTimeout(() => this.router.navigate(['/marks']), 2000);
      },
      error: (err) => {
        console.error('Error saving marks:', err);
        this.snack.open('Failed to save marks', 'Close', { duration: 3000 });
        this.saving = false;
      }
    });
  }

  validateMarks(): boolean {
    for (const student of this.students) {
      for (const element of this.assessmentElements) {
        const mark = student.marks[element.element_id];
        if (mark !== undefined && mark !== null) {
          if (mark < 0 || mark > element.max_score) {
            return false;
          }
        }
      }
    }
    return true;
  }

  goBack(): void {
    this.router.navigate(['/marks']);
  }
}
