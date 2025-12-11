import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AnalyticsService, AnalyticsData } from '../../services/analytics.service';
import { SchoolService } from '../../services/school.service';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import Chart from 'chart.js/auto'; // Register chart.js controllers

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    BaseChartDirective
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
    sms: true,
    charts: true
  };
  errors = {
    overview: null as string | null,
    status: null as string | null,
    gender: null as string | null,
    sms: null as string | null
  };

  // Chart Properties
  public classChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      { data: [], label: 'Students', backgroundColor: '#667eea', hoverBackgroundColor: '#5a67d8' }
    ]
  };
  public classChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  public genderChartData: ChartData<'doughnut'> = {
    labels: ['Boys', 'Girls'],
    datasets: [
      {
        data: [],
        backgroundColor: ['#06b6d4', '#f43f5e'],
        hoverBackgroundColor: ['#0891b2', '#e11d48'],
        borderWidth: 0
      }
    ]
  };
  public genderChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8 } }
    },
    cutout: '70%'
  };

  constructor(
    private analyticsService: AnalyticsService,
    private schoolService: SchoolService,
    private snackBar: MatSnackBar
  ) { }

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
    this.loading = { overview: true, status: true, gender: true, sms: true, charts: true };
    this.errors = { overview: null, status: null, gender: null, sms: null };

    const schoolId = this.schoolService.getSelectedSchoolId();

    if (!schoolId) {
      this.loading = { overview: false, status: false, gender: false, sms: false, charts: false };
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

    // Load all analytics data at once; pass refresh flag to request live provider balance when requested
    const yearParam = this.selectedYear || undefined;
    const termParam = (this.selectedTerm === '' || this.selectedTerm === undefined) ? undefined : Number(this.selectedTerm);

    this.analyticsService.getAnalytics(schoolId, yearParam, termParam, refresh).subscribe({
      next: (data) => {
        this.analytics = data;
        // Mark all sections as loaded
        this.loading = { overview: false, status: false, gender: false, sms: false, charts: false };

        // Update Charts
        this.updateCharts(data);
      },
      error: (err) => {
        console.error('Error loading analytics:', err);
        // Mark all sections as failed
        this.loading = { overview: false, status: false, gender: false, sms: false, charts: false };
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

  updateCharts(data: AnalyticsData) {
    // Chart 1: Students per Class
    if (data.studentsPerClass) {
      this.classChartData = {
        labels: data.studentsPerClass.map(i => i.className),
        datasets: [{
          data: data.studentsPerClass.map(i => i.count),
          label: 'Students',
          backgroundColor: '#667eea',
          hoverBackgroundColor: '#5a67d8',
          borderRadius: 4,
          barThickness: 20
        }]
      };
    }

    // Chart 2: Boys vs Girls
    // Assuming activeBoys and activeGirls are present.
    // If they are 0, we should maybe handle it, but chart.js handles 0s fine (empty chart or just segments).
    this.genderChartData = {
      labels: ['Boys', 'Girls'],
      datasets: [{
        data: [data.activeBoys, data.activeGirls],
        backgroundColor: ['#06b6d4', '#f43f5e'],
        hoverBackgroundColor: ['#0891b2', '#e11d48'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    };
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
