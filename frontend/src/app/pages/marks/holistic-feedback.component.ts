import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MarksService } from '../../services/marks.service';

interface HolisticMetric {
  metric_id: number;
  metric_type: string;
  metric_name: string;
  rating?: string;
}

interface StudentHolistic {
  student_id: number;
  student_name: string;
  reg_number: string;
  metrics: HolisticMetric[];
}

@Component({
  selector: 'app-holistic-feedback',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './holistic-feedback.component.html',
  styleUrls: ['./holistic-feedback.component.scss']
})
export class HolisticFeedbackComponent implements OnInit {
  examSetId: number = 0;
  schoolId: number = 0;
  students: StudentHolistic[] = [];
  metrics: HolisticMetric[] = [];
  loading = false;
  saving = false;
  metricTypes: string[] = [];
  selectedMetricType = 'all';

  constructor(
    private marksService: MarksService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const storedSchoolId = localStorage.getItem('currentSchoolId');
    if (storedSchoolId) {
      this.schoolId = parseInt(storedSchoolId);
    }

    this.route.params.subscribe((params) => {
      this.examSetId = params['examSetId'];
      if (this.examSetId) {
        this.loadData();
      }
    });
  }

  loadData(): void {
    this.loading = true;
    Promise.all([
      this.loadExamSetStudents(),
      this.loadHolisticMetrics()
    ]).finally(() => {
      this.loading = false;
    });
  }

  loadExamSetStudents(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.marksService.getExamSetStudents(this.examSetId).subscribe({
        next: (data: any[]) => {
          this.students = data.map((student) => ({
            student_id: student.student_id,
            student_name: student.full_name,
            reg_number: student.reg_number,
            metrics: []
          }));
          resolve();
        },
        error: (err) => {
          console.error('Error loading students:', err);
          reject(err);
        }
      });
    });
  }

  loadHolisticMetrics(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.marksService.getHolisticMetrics(this.schoolId).subscribe({
        next: (data: any[]) => {
          this.metrics = data;
          
          // Extract unique metric types
          this.metricTypes = [...new Set(data.map((m) => m.metric_type))];

          // Load existing feedback for all students
          this.loadExistingFeedback();
          resolve();
        },
        error: (err) => {
          console.error('Error loading metrics:', err);
          reject(err);
        }
      });
    });
  }

  loadExistingFeedback(): void {
    this.students.forEach((student) => {
      this.marksService
        .getHolisticFeedback(student.student_id, this.schoolId)
        .subscribe({
          next: (feedback: any[]) => {
            // Map existing feedback to metrics
            student.metrics = this.metrics.map((metric) => {
              const existingFeedback = feedback.find((f) => f.metric_id === metric.metric_id);
              return {
                ...metric,
                rating: existingFeedback?.rating || ''
              };
            });
          },
          error: (err) => console.error('Error loading feedback:', err)
        });
    });
  }

  getMetricsForType(metricType: string): HolisticMetric[] {
    return this.metrics.filter((m) => m.metric_type === metricType);
  }

  getStudentMetricsForType(student: StudentHolistic, metricType: string): HolisticMetric[] {
    return student.metrics.filter((m) => m.metric_type === metricType);
  }

  getStudentMetricRating(student: StudentHolistic, metricId: number): string {
    const metric = student.metrics.find((m) => m.metric_id === metricId);
    return metric?.rating || '';
  }

  updateRating(student: StudentHolistic, metric: HolisticMetric, newRating: string): void {
    const studentMetric = student.metrics.find((m) => m.metric_id === metric.metric_id);
    if (studentMetric) {
      studentMetric.rating = newRating;
    }
  }

  saveAllFeedback(): void {
    this.saving = true;
    const feedbackList: any[] = [];

    this.students.forEach((student) => {
      student.metrics.forEach((metric) => {
        if (metric.rating) {
          feedbackList.push({
            student_id: student.student_id,
            school_id: this.schoolId,
            metric_id: metric.metric_id,
            rating: metric.rating
          });
        }
      });
    });

    this.marksService.saveBulkHolisticFeedback(feedbackList).subscribe({
      next: () => {
        alert('Holistic feedback saved successfully!');
        this.saving = false;
      },
      error: (err) => {
        console.error('Error saving feedback:', err);
        alert('Failed to save feedback: ' + (err.error?.message || 'Unknown error'));
        this.saving = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/marks']);
  }

  exportAsCSV(): void {
    const headers = ['Student Name', 'Reg Number', ...this.metrics.map((m) => m.metric_name)];
    const rows = this.students.map((student) => [
      student.student_name,
      student.reg_number,
      ...student.metrics.map((m) => m.rating || '')
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `holistic_feedback_${this.examSetId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
