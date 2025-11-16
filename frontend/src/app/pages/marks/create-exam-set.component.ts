import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MarksService, CreateExamSetRequest, Subject, AssessmentType } from '../../services/marks.service';
import { SchoolService } from '../../services/school.service';
import { ClassCategorizationService } from '../../services/class-categorization.service';

interface SubjectElement {
  element_name: string;
  max_score: number;
  contributing_weight_percent: number;
}

interface SubjectSelection {
  subject_id: number;
  subject_name: string;
  elements: SubjectElement[];
}

@Component({
  selector: 'app-create-exam-set',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-exam-set.component.html',
  styleUrls: ['./create-exam-set.component.scss']
})
export class CreateExamSetComponent implements OnInit {
  schoolId: number = 0;
  setName: string = '';
  classLevel: string = '';
  term: number = 1;
  year: number = new Date().getFullYear();
  assessmentType: AssessmentType = 'Mixed';
  
  availableSubjects: Subject[] = [];
  selectedSubjects: SubjectSelection[] = [];
  classes: string[] = [];
  availableYears: number[] = [];
  loading = false;
  loadingClasses = false;
  loadingSubjects = false;

  constructor(
    private marksService: MarksService,
    private router: Router,
    private schoolService: SchoolService,
    private classCategorizationService: ClassCategorizationService
  ) {}

  ngOnInit(): void {
    // Get the school from SchoolService (authenticated user's school)
    this.schoolService.getMySchool().subscribe({
      next: (school) => {
        if (school) {
          this.schoolId = school.school_id;
          // Load class levels based on school type
          try {
            const schoolType = this.schoolService.getSelectedSchoolType();
            if (schoolType) {
              this.classes = this.classCategorizationService.getClassesForSchoolType(schoolType);
            } else {
              this.classes = [];
            }
          } catch (err) {
            this.classes = [];
          }
        }
      },
      error: (err) => {
        console.error('Error loading school:', err);
        this.classes = [];
      }
    });
    
    // Generate available years: current + past 9 years
    const currentYear = new Date().getFullYear();
    this.availableYears = [];
    for (let i = 0; i < 10; i++) {
      this.availableYears.push(currentYear - i);
    }
    this.availableYears.reverse(); // Sort ascending for better UX
  }

  onClassLevelChange(): void {
    this.availableSubjects = []; // Reset
    this.loadingSubjects = false; // Reset
    if (this.classLevel && this.schoolId) {
      console.log(`Loading subjects for school ${this.schoolId}, level ${this.classLevel}`);
      this.loadingSubjects = true;
      this.marksService.getSubjects(this.schoolId, this.classLevel).subscribe({
        next: (subjects) => {
          console.log('Subjects loaded:', subjects);
          this.availableSubjects = subjects || [];
          this.loadingSubjects = false;
          if (subjects.length === 0) {
            console.warn(`No subjects found for school ${this.schoolId}, level ${this.classLevel}`);
          }
        },
        error: (err) => {
          console.error('Error loading subjects:', err);
          this.availableSubjects = [];
          this.loadingSubjects = false;
        }
      });
    }
  }

  addSubject(subject: Subject): void {
    if (!this.selectedSubjects.find(s => s.subject_id === subject.subject_id)) {
      this.selectedSubjects.push({
        subject_id: subject.subject_id,
        subject_name: subject.subject_name,
        elements: []
      });
    }
  }

  removeSubject(subjectId: number): void {
    this.selectedSubjects = this.selectedSubjects.filter(s => s.subject_id !== subjectId);
  }

  addElement(subject: SubjectSelection): void {
    subject.elements.push({
      element_name: '',
      max_score: 100,
      contributing_weight_percent: 0
    });
  }

  removeElement(subject: SubjectSelection, index: number): void {
    subject.elements.splice(index, 1);
  }

  // Helper for template: compute total weight for a subject
  totalWeight(subject: SubjectSelection): number {
    return subject.elements?.reduce((sum, el) => sum + (el.contributing_weight_percent || 0), 0) || 0;
  }

  // Helper for template: whether total weight deviates from 100 by more than 0.01
  weightWarning(subject: SubjectSelection): boolean {
    return Math.abs(this.totalWeight(subject) - 100) > 0.01;
  }

  createExamSet(): void {
    if (!this.validateForm()) {
      console.error('Validation failed. Form state:', {
        setName: this.setName,
        classLevel: this.classLevel,
        term: this.term,
        year: this.year,
        selectedSubjects: this.selectedSubjects.map(s => ({
          subject_name: s.subject_name,
          elements: s.elements,
          totalWeight: this.totalWeight(s)
        }))
      });
      alert('Please fill in all required fields and ensure percentages sum to 100 for each subject');
      return;
    }

    const request: CreateExamSetRequest = {
      school_id: this.schoolId,
      set_name: this.setName,
      class_level: this.classLevel,
      term: this.term,
      year: this.year,
      assessment_type: this.assessmentType,
      subjects: this.selectedSubjects.map(s => ({
        subject_id: s.subject_id,
        elements: s.elements
      }))
    };

    this.loading = true;
    this.marksService.createExamSet(request).subscribe({
      next: (result) => {
        alert('Exam set created successfully!');
        this.router.navigate(['/marks']);
      },
      error: (err) => {
        console.error('Error creating exam set:', err);
        alert('Failed to create exam set: ' + (err.error?.message || 'Unknown error'));
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/marks']);
  }

  validateForm(): boolean {
    // Basic field validation
    if (!this.setName?.trim()) return false;
    if (!this.classLevel) return false;
    if (!this.term) return false;
    if (!this.year) return false;
    if (this.selectedSubjects.length === 0) return false;

    // Validate each subject
    for (const subject of this.selectedSubjects) {
      // Must have at least one element
      if (!subject.elements || subject.elements.length === 0) return false;
      
      // Validate each element
      for (const element of subject.elements) {
        if (!element.element_name?.trim()) return false;
        if (!element.max_score || element.max_score <= 0) return false;
        if (element.contributing_weight_percent === null || element.contributing_weight_percent === undefined) return false;
      }
      
      // Check weight sums to 100 (with tolerance for floating point)
      const totalWeight = subject.elements.reduce((sum, el) => sum + (el.contributing_weight_percent || 0), 0);
      if (Math.abs(totalWeight - 100) > 0.1) return false;
    }

    return true;
  }
}
