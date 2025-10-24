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
  loading = {
    overview: true,
    status: true,
    gender: true,
    sms: true
  };
  errors = {
    overview: null as string | null,
    status: null as string | null,
    gender: null as string | null,
    sms: null as string | null
  };

  constructor(
    private analyticsService: AnalyticsService,
    private schoolService: SchoolService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadAnalytics();
  }

  loadAnalytics(): void {
    // Reset all loading states
    this.loading = { overview: true, status: true, gender: true, sms: true };
    this.errors = { overview: null, status: null, gender: null, sms: null };
    
    const schoolId = this.schoolService.getSelectedSchoolId();
    
    if (!schoolId) {
      this.loading = { overview: false, status: false, gender: false, sms: false };
      this.errors = {
        overview: 'No school selected',
        status: 'No school selected',
        gender: 'No school selected',
        sms: 'No school selected'
      };
      this.snackBar.open('Please select a school first', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar'],
        verticalPosition: 'top',
        horizontalPosition: 'center'
      });
      return;
    }

    // Load all analytics data at once
    this.analyticsService.getAnalytics(schoolId).subscribe({
      next: (data) => {
        this.analytics = data;
        // Mark all sections as loaded
        this.loading = { overview: false, status: false, gender: false, sms: false };
      },
      error: (err) => {
        console.error('Error loading analytics:', err);
        // Mark all sections as failed
        this.loading = { overview: false, status: false, gender: false, sms: false };
        this.errors = {
          overview: 'Failed to load',
          status: 'Failed to load',
          gender: 'Failed to load',
          sms: 'Failed to load'
        };
        this.snackBar.open('Failed to load analytics', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar'],
          verticalPosition: 'top',
          horizontalPosition: 'center'
        });
      }
    });
  }

  refresh(): void {
    this.loadAnalytics();
  }

  get anyLoading(): boolean {
    return Object.values(this.loading).some(v => v);
  }
}
