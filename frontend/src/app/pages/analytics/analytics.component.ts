import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
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
    ,MatFormFieldModule,MatSelectModule,MatButtonModule
  ],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss']
})
export class AnalyticsComponent implements OnInit {
  analytics: AnalyticsData | null = null;
  // Year and term filters (defaults)
  years: string[] = [];
  selectedYear: string = '';
  termOptions: Array<string | number> = ['', 1, 2, 3]; // '' means all
  selectedTerm: string | number = '';
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
    // Prepare year options (use current year and nearby years)
    const currentYear = new Date().getFullYear();
    this.years = [String(currentYear - 2), String(currentYear - 1), String(currentYear)];
    this.selectedYear = String(currentYear);
    this.selectedTerm = '';

    this.loadAnalytics();
  }

  loadAnalytics(refresh: boolean = true): void {
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

  // Load analytics data with optional year/term filters
  const yearParam = this.selectedYear || undefined;
  const termParam = (this.selectedTerm === '' || this.selectedTerm === undefined) ? undefined : Number(this.selectedTerm);

  // Load all analytics data at once; pass refresh flag to request live provider balance when requested
  this.analyticsService.getAnalytics(schoolId, yearParam, termParam, refresh).subscribe({
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
    // explicit refresh request - asking backend to call provider live
    this.loadAnalytics(true);
  }

  onYearChange(value: string): void {
    this.selectedYear = value;
    this.loadAnalytics();
  }

  onTermChange(value: string | number): void {
    this.selectedTerm = value;
    this.loadAnalytics();
  }

  get anyLoading(): boolean {
    return Object.values(this.loading).some(v => v);
  }
}
