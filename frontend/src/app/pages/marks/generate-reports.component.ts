import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MarksService, ExamSet } from '../../services/marks.service';

@Component({
  selector: 'app-generate-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './generate-reports.component.html',
  styleUrls: ['./generate-reports.component.scss']
})
export class GenerateReportsComponent implements OnInit {
  schoolId: number = 0;
  examSets: ExamSet[] = [];
  selectedExamSetId: number | null = null;
  loading = false;
  generatingReport = false;

  constructor(
    private marksService: MarksService,
    private router: Router
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
        this.loading = false;
      }
    });
  }

  generateReport(): void {
    if (!this.selectedExamSetId) {
      alert('Please select an exam set');
      return;
    }

    this.generatingReport = true;
    // Placeholder: generate report when backend endpoint is ready
    setTimeout(() => {
      alert('Report generated successfully');
      this.generatingReport = false;
    }, 1000);
  }

  goBack(): void {
    this.router.navigate(['/marks']);
  }
}
