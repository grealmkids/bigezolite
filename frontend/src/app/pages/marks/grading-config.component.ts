import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MarksService, GradingScale } from '../../services/marks.service';
import { SchoolService } from '../../services/school.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-grading-config',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './grading-config.component.html',
  styleUrls: ['./grading-config.component.scss']
})
export class GradingConfigComponent implements OnInit {
  schoolId: number = 0;
  schoolType: string = 'Secondary'; // Will be fetched

  // School Settings
  curriculumType: string = 'Secondary-LSC';

  // Grading Scales
  gradingScaleType: string = '8-level'; // Default
  gradingScaleOptions = ['8-level', '5-level (A-E)'];

  eightLevelScale: GradingScale[] = [
    { scale_id: 0, school_id: 0, grade_letter: 'A', descriptor: 'Excellent', min_score_percent: 80 },
    { scale_id: 0, school_id: 0, grade_letter: 'B', descriptor: 'Very Good', min_score_percent: 70 }, // Adjusted typical scale
    { scale_id: 0, school_id: 0, grade_letter: 'C', descriptor: 'Good', min_score_percent: 60 },
    { scale_id: 0, school_id: 0, grade_letter: 'D', descriptor: 'Satisfactory', min_score_percent: 50 },
    { scale_id: 0, school_id: 0, grade_letter: 'E', descriptor: 'Adequate', min_score_percent: 40 },
    { scale_id: 0, school_id: 0, grade_letter: 'F', descriptor: 'Fair', min_score_percent: 30 },
    { scale_id: 0, school_id: 0, grade_letter: 'G', descriptor: 'Weak', min_score_percent: 20 },
    { scale_id: 0, school_id: 0, grade_letter: 'H', descriptor: 'Poor', min_score_percent: 0 }
  ];

  fiveLevelScale: GradingScale[] = [
    { scale_id: 0, school_id: 0, grade_letter: 'A', descriptor: 'Excellent', min_score_percent: 80 },
    { scale_id: 0, school_id: 0, grade_letter: 'B', descriptor: 'Good', min_score_percent: 60 },
    { scale_id: 0, school_id: 0, grade_letter: 'C', descriptor: 'Average', min_score_percent: 40 },
    { scale_id: 0, school_id: 0, grade_letter: 'D', descriptor: 'Below Average', min_score_percent: 20 },
    { scale_id: 0, school_id: 0, grade_letter: 'E', descriptor: 'Poor', min_score_percent: 0 }
  ];

  currentScale: GradingScale[] = [];

  // Assessment weights (LSC/P7)
  formativeWeight: number = 20;
  summativeWeight: number = 80;

  loading = true;
  saving = false;

  constructor(
    private router: Router,
    private snack: MatSnackBar,
    private marksService: MarksService,
    private schoolService: SchoolService
  ) { }

  async ngOnInit(): Promise<void> {
    // Try to get school ID from multiple sources
    const localId = localStorage.getItem('currentSchoolId');
    const selectedSchoolId = this.schoolService.getSelectedSchoolId();

    if (localId) {
      this.schoolId = parseInt(localId);
    } else if (selectedSchoolId) {
      this.schoolId = selectedSchoolId;
    }

    if (this.schoolId) {
      await this.initializeConfig();
    } else {
      this.loading = false;
      this.snack.open('Error: School ID not found. Please relogin.', 'Close', { duration: 5000 });
    }
  }

  async initializeConfig() {
    try {
      this.loading = true;

      // 1. Fetch School Details (School Type)
      // Use selectedSchool$ to get cached data immediately
      let school = await firstValueFrom(this.schoolService.selectedSchool$);

      // Fallback if null (e.g. page refresh)
      if (!school) {
        school = await firstValueFrom(this.schoolService.getMySchool());
      }

      if (school) {
        this.schoolType = school.school_type || 'Secondary';
        // Ensure we have the correct schoolId
        this.schoolId = school.school_id;

        // Auto-select curriculum based on school type
        if (this.schoolType.toLowerCase().includes('primary') || this.schoolType.toLowerCase().includes('nursery')) {
          this.curriculumType = 'Primary-Local';
        } else if (this.schoolType.toLowerCase().includes('international')) {
          this.curriculumType = 'International';
        } else {
          this.curriculumType = 'Secondary-LSC';
        }
      }

      // 2. Fetch Existing Settings & Scales
      const existingScales = await firstValueFrom(this.marksService.getGradingScales(this.schoolId));

      let existingSettings = null;
      try {
        existingSettings = await firstValueFrom(this.marksService.getSchoolSetting(this.schoolId));
      } catch (e) {
        // limit 404 noise
      }

      // 3. Apply Settings if exist
      if (existingSettings) {
        this.curriculumType = existingSettings.curriculum_type;
      } else {
        // Set defaults based on curriculum
        if (this.curriculumType === 'Primary-Local') {
          this.formativeWeight = 40;
          this.summativeWeight = 60;
        } else {
          this.formativeWeight = 20;
          this.summativeWeight = 80;
        }
      }

      // 4. Apply Scales if exist
      if (existingScales && existingScales.length > 0) {
        this.currentScale = existingScales.sort((a, b) => b.min_score_percent - a.min_score_percent);
        // Infer scale type
        this.gradingScaleType = existingScales.length === 5 ? '5-level (A-E)' : '8-level';
      } else {
        this.setGradingScale(); // Load defaults
      }

    } catch (error) {
      console.warn('Could not load existing config, using defaults', error);
      this.setGradingScale();
    } finally {
      this.loading = false;
    }
  }

  setGradingScale(): void {
    if (this.gradingScaleType === '8-level') {
      // Clone objects to avoid reference issues
      this.currentScale = this.eightLevelScale.map(s => ({ ...s }));
    } else {
      this.currentScale = this.fiveLevelScale.map(s => ({ ...s }));
    }
  }

  onGradingScaleTypeChange(): void {
    if (confirm('Changing the scale type will reset current values to defaults. Continue?')) {
      this.setGradingScale();
    } else {
      // Revert selection if user cancels (would need more complex binding handling, skipping for now)
    }
  }

  onWeightChange(): void {
    // UI validation mainly
  }

  updateGradeDescriptor(scale: GradingScale, newDescriptor: string): void {
    scale.descriptor = newDescriptor;
  }

  updateGradeThreshold(scale: GradingScale, newThreshold: number): void {
    scale.min_score_percent = newThreshold;
  }

  async saveGradingConfig(): Promise<void> {
    if (this.formativeWeight + this.summativeWeight !== 100) {
      this.snack.open('Weights must sum to exactly 100%', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    try {
      // 1. Save School Settings (Curriculum)
      await firstValueFrom(this.marksService.createOrUpdateSchoolSetting({
        school_id: this.schoolId,
        curriculum_type: this.curriculumType as any
      }));

      // 2. Save Grading Scales (Bulk Replace)
      // Note: Backend bulkCreate usually handles delete-insert or upsert.
      // We will map our current scale to the format expected
      const scalesToSave = this.currentScale.map(s => ({
        grade_letter: s.grade_letter,
        descriptor: s.descriptor || '',
        min_score_percent: s.min_score_percent
      }));

      await firstValueFrom(this.marksService.bulkCreateGradingScales(this.schoolId, scalesToSave));

      this.snack.open('Configuration saved to database successfully!', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Save failed', error);
      this.snack.open('Failed to save configuration. Please try again.', 'Close', { duration: 4000 });
    } finally {
      this.saving = false;
    }
  }

  goBack(): void {
    this.router.navigate(['/marks']);
  }
}
