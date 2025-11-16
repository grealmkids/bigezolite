import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MarksService, ExamSet } from '../../services/marks.service';

@Component({
  selector: 'app-marks-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './marks-dashboard.component.html',
  styleUrls: ['./marks-dashboard.component.scss']
})
export class MarksDashboardComponent implements OnInit {
  examSets: ExamSet[] = [];
  loading = false;
  schoolId: number = 0;

  constructor(private marksService: MarksService) {}

  ngOnInit(): void {
    const storedSchoolId = localStorage.getItem('currentSchoolId');
    if (storedSchoolId) {
      this.schoolId = parseInt(storedSchoolId);
      console.log('[MarksDashboard] Loading with schoolId:', this.schoolId);
      this.loadExamSets();
    } else {
      console.warn('[MarksDashboard] No schoolId found in localStorage');
    }
  }

  loadExamSets(): void {
    this.loading = true;
    console.log('[MarksDashboard] Fetching exam sets for schoolId:', this.schoolId);
    this.marksService.getExamSets(this.schoolId).subscribe({
      next: (data) => {
        console.log('[MarksDashboard] Exam sets loaded:', data.length);
        this.examSets = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('[MarksDashboard] Error loading exam sets:', err);
        this.loading = false;
      }
    });
  }
}
