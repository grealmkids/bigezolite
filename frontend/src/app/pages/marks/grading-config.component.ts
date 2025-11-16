import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface GradingScale {
  grade_letter: string;
  descriptor: string;
  min_score_percent: number;
}

@Component({
  selector: 'app-grading-config',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './grading-config.component.html',
  styleUrls: ['./grading-config.component.scss']
})
export class GradingConfigComponent implements OnInit {
  schoolId: number = 0;
  
  // School Settings
  curriculumType: string = 'Secondary-LSC';
  curriculumOptions = ['Primary-Local', 'Secondary-LSC', 'International'];
  
  // Grading Scales
  gradingScaleType: string = '8-level'; // or '5-level'
  gradingScaleOptions = ['8-level', '5-level (A-E)'];
  
  eightLevelScale: GradingScale[] = [
    { grade_letter: 'A', descriptor: 'Excellent', min_score_percent: 80 },
    { grade_letter: 'B+', descriptor: 'Very Good', min_score_percent: 75 },
    { grade_letter: 'B', descriptor: 'Good', min_score_percent: 70 },
    { grade_letter: 'C+', descriptor: 'Above Average', min_score_percent: 60 },
    { grade_letter: 'C', descriptor: 'Average', min_score_percent: 50 },
    { grade_letter: 'D+', descriptor: 'Below Average', min_score_percent: 40 },
    { grade_letter: 'D', descriptor: 'Poor', min_score_percent: 30 },
    { grade_letter: 'E', descriptor: 'Very Poor', min_score_percent: 0 }
  ];
  
  fiveLevelScale: GradingScale[] = [
    { grade_letter: 'A', descriptor: 'Excellent', min_score_percent: 80 },
    { grade_letter: 'B', descriptor: 'Good', min_score_percent: 60 },
    { grade_letter: 'C', descriptor: 'Average', min_score_percent: 40 },
    { grade_letter: 'D', descriptor: 'Below Average', min_score_percent: 20 },
    { grade_letter: 'E', descriptor: 'Poor', min_score_percent: 0 }
  ];
  
  currentScale: GradingScale[] = [];
  
  // Assessment weights (LSC/P7)
  formativeWeight: number = 20;
  summativeWeight: number = 80;
  
  loading = false;
  saving = false;

  constructor(
    private router: Router,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    const storedSchoolId = localStorage.getItem('currentSchoolId');
    if (storedSchoolId) {
      this.schoolId = parseInt(storedSchoolId);
      this.loadGradingConfig();
    }
    this.setGradingScale();
  }

  loadGradingConfig(): void {
    // Load from localStorage or backend API when available
    const stored = localStorage.getItem(`gradingConfig_${this.schoolId}`);
    if (stored) {
      const config = JSON.parse(stored);
      this.curriculumType = config.curriculumType || 'Secondary-LSC';
      this.gradingScaleType = config.gradingScaleType || '8-level';
      this.formativeWeight = config.formativeWeight || 20;
      this.summativeWeight = config.summativeWeight || 80;
    }
    this.setGradingScale();
  }

  setGradingScale(): void {
    if (this.gradingScaleType === '8-level') {
      this.currentScale = [...this.eightLevelScale];
    } else {
      this.currentScale = [...this.fiveLevelScale];
    }
  }

  onGradingScaleTypeChange(): void {
    this.setGradingScale();
  }

  onWeightChange(): void {
    // Ensure weights sum to 100
    if (this.formativeWeight + this.summativeWeight !== 100) {
      this.snack.open('Weights must sum to 100%', 'Close', { duration: 3000 });
    }
  }

  updateGradeDescriptor(scale: GradingScale, newDescriptor: string): void {
    scale.descriptor = newDescriptor;
  }

  updateGradeThreshold(scale: GradingScale, newThreshold: number): void {
    scale.min_score_percent = newThreshold;
  }

  saveGradingConfig(): void {
    // Validate weights
    if (this.formativeWeight + this.summativeWeight !== 100) {
      this.snack.open('Weights must sum to exactly 100%', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    const config = {
      school_id: this.schoolId,
      curriculumType: this.curriculumType,
      gradingScaleType: this.gradingScaleType,
      formativeWeight: this.formativeWeight,
      summativeWeight: this.summativeWeight,
      gradingScale: this.currentScale
    };

    // Save to localStorage for now (replace with API call when backend is ready)
    localStorage.setItem(`gradingConfig_${this.schoolId}`, JSON.stringify(config));
    
    this.saving = false;
    this.snack.open('Grading configuration saved successfully!', 'Close', { duration: 3000 });
  }

  goBack(): void {
    this.router.navigate(['/marks']);
  }
}
