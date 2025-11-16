import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MarksService, ExamSet } from '../../services/marks.service';
import { StudentService, Student } from '../../services/student.service';

interface StudentResult {
  student_name: string;
  reg_number: string;
  formative_score: number;
  summative_score: number;
  final_grade: string;
  holistic_feedback: string;
}

@Component({
  selector: 'app-student-report',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule],
  templateUrl: './student-report.component.html',
  styleUrls: ['./student-report.component.scss']
})
export class StudentReportComponent implements OnInit {
  examSetId: number = 0;
  studentId: number = 0;
  
  examSet: ExamSet | null = null;
  student: Student | null = null;
  result: StudentResult | null = null;
  
  loading = false;
  generating = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private marksService: MarksService,
    private studentService: StudentService,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.examSetId = parseInt(params['examSetId']);
      this.studentId = parseInt(params['studentId']);
      
      if (this.examSetId && this.studentId) {
        this.loadData();
      }
    });
  }

  loadData(): void {
    this.loading = true;
    
    this.marksService.getExamSetById(this.examSetId).subscribe({
      next: (examSet) => {
        this.examSet = examSet;
        this.loadStudent();
      },
      error: (err) => {
        console.error('Error loading exam set:', err);
        this.snack.open('Failed to load exam set', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  loadStudent(): void {
    this.studentService.getStudentById(this.studentId).subscribe({
      next: (student) => {
        this.student = student;
        this.loadStudentResults();
      },
      error: (err) => {
        console.error('Error loading student:', err);
        this.snack.open('Failed to load student', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  loadStudentResults(): void {
    this.marksService.getStudentExamResults(this.examSetId, this.studentId).subscribe({
      next: (result) => {
        this.result = result;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading results:', err);
        this.snack.open('Failed to load student results', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  generatePDF(): void {
    if (!this.student || !this.result) {
      this.snack.open('Missing student or result data', 'Close', { duration: 3000 });
      return;
    }

    this.generating = true;
    this.marksService.generateStudentReportPDF(this.examSetId, this.studentId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.student!.student_name}_Report.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.generating = false;
        this.snack.open('Report downloaded successfully', 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Error generating PDF:', err);
        this.snack.open('Failed to generate PDF', 'Close', { duration: 3000 });
        this.generating = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/marks/view-marks']);
  }
}
