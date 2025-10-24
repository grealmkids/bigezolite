import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AnalyticsService, AnalyticsData } from '../../services/analytics.service';
import { SchoolService } from '../../services/school.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss']
})
export class AnalyticsComponent implements OnInit {
  analytics: AnalyticsData | null = null;
  loading = true;
  error: string | null = null;

  constructor(
    private analyticsService: AnalyticsService,
    private schoolService: SchoolService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadAnalytics();
  }

  loadAnalytics(): void {
    this.loading = true;
    this.error = null;
    
    const schoolId = this.schoolService.getSelectedSchoolId();
    
    if (!schoolId) {
      this.error = 'No school selected';
      this.loading = false;
      this.snackBar.open('Please select a school first', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    this.analyticsService.getAnalytics(schoolId).subscribe({
      next: (data) => {
        this.analytics = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading analytics:', err);
        this.error = 'Failed to load analytics data';
        this.loading = false;
        this.snackBar.open('Failed to load analytics', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  refresh(): void {
    this.loadAnalytics();
  }
}
