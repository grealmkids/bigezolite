import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MarksService, ExamSet } from '../../services/marks.service';
import { SchoolService } from '../../services/school.service';
import { ClassCategorizationService } from '../../services/class-categorization.service';
import { StudentService } from '../../services/student.service';

interface StudentReport {
  student_id: number;
  student_name: string;
  reg_number: string;
  class_name: string;
}

@Component({
  selector: 'app-generate-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './generate-reports.component.html',
  styleUrls: ['./generate-reports.component.scss']
})
export class GenerateReportsComponent implements OnInit {
  schoolId: number = 0;
  classes: string[] = [];
  selectedClass: string = '';
  years: number[] = [];
  selectedYear: number = new Date().getFullYear();
  
  examSets: ExamSet[] = [];
  selectedExamSetId: number | null = null;
  students: StudentReport[] = [];
  
  loading = false;
  loadingStudents = false;
  generatingReport = false;

  constructor(
    private marksService: MarksService,
    private router: Router,
    private schoolService: SchoolService,
    private classCategorizationService: ClassCategorizationService,
    private studentService: StudentService
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

  loadStudents(): void {
    if (!this.selectedClass) return;
    
    this.loadingStudents = true;
    // Use StudentService to fetch students filtered by class
    this.studentService.getStudents(this.schoolId, undefined, this.selectedClass).subscribe({
      next: (result: any) => {
        // StudentService returns { items: [], total: number }
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

  createStudentReport(student: StudentReport): void {
    if (!this.selectedExamSetId) {
      alert('Please select an exam set');
      return;
    }

    this.generatingReport = true;
    // Generate PDF by navigating to student report component
    // The PDF will be generated server-side via the report endpoint
    this.marksService.generateStudentReportPDF(this.selectedExamSetId, student.student_id).subscribe({
      next: (pdfData: Blob) => {
        // Trigger PDF download
        const blob = new Blob([pdfData], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Report_${student.student_name}_${this.selectedYear}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.generatingReport = false;
      },
      error: (err: any) => {
        console.error('Error generating report:', err);
        alert('Failed to generate report');
        this.generatingReport = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/marks']);
  }
}
