import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MarksService, ExamSet, AssessmentElement } from '../../services/marks.service';
import { SchoolService } from '../../services/school.service';

interface Subject {
  subject_id: number;
  subject_name: string;
}

interface ElementForm {
  element_name: string;
  max_score: number | null;
  contributing_weight_percent: number | null;
}

@Component({
  selector: 'app-manage-assessment-elements',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './manage-assessment-elements.component.html',
  styleUrls: ['./manage-assessment-elements.component.scss']
})
export class ManageAssessmentElementsComponent implements OnInit {
  schoolId: number = 0;
  examSets: ExamSet[] = [];
  selectedExamSetId: number | null = null;
  selectedExamSet: ExamSet | null = null;

  subjects: Subject[] = [];
  selectedSubjectId: number | null = null;
  elements: AssessmentElement[] = [];

  loading = false;
  saving = false;
  showAddForm = false;
  editingElementId: number | null = null;

  newElement: ElementForm = {
    element_name: '',
    max_score: null,
    contributing_weight_percent: null
  };

  editingElement: ElementForm = {
    element_name: '',
    max_score: null,
    contributing_weight_percent: null
  };

  constructor(
    private router: Router,
    private marksService: MarksService,
    private schoolService: SchoolService,
    private snack: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.schoolService.getMySchool().subscribe({
      next: (school) => {
        if (school) {
          this.schoolId = school.school_id;
          this.loadExamSets();
        }
      },
      error: (err) => console.error('Error loading school:', err)
    });
  }

  loadExamSets(): void {
    this.loading = true;
    this.marksService.getExamSets(this.schoolId).subscribe({
      next: (data) => {
        this.examSets = data.sort((a, b) =>
          `${b.year}${b.term}`.localeCompare(`${a.year}${a.term}`)
        );
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading exam sets:', err);
        this.snack.open('Failed to load exam sets', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  onExamSetChange(examSetId: number | null): void {
    this.selectedExamSetId = examSetId;
    this.selectedExamSet = examSetId ? this.examSets.find(e => e.exam_set_id === examSetId) || null : null;
    this.selectedSubjectId = null;
    this.elements = [];
    this.subjects = [];
    if (examSetId) {
      this.loadSubjectsForExamSet();
    }
  }

  loadSubjectsForExamSet(): void {
    if (!this.selectedExamSetId) return;

    this.loading = true;
    this.marksService.getAssessmentElements(this.selectedExamSetId).subscribe({
      next: (elements) => {
        const subjectMap = new Map<number, Subject>();
        elements.forEach(el => {
          if (!subjectMap.has(el.subject_id)) {
            subjectMap.set(el.subject_id, {
              subject_id: el.subject_id,
              subject_name: el.subject_name || `Subject ${el.subject_id}`
            });
          }
        });
        this.subjects = Array.from(subjectMap.values()).sort((a, b) =>
          a.subject_name.localeCompare(b.subject_name)
        );
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading subjects:', err);
        this.snack.open('Failed to load subjects', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  onSubjectChange(subjectId: number | null): void {
    this.selectedSubjectId = subjectId;
    if (subjectId) {
      this.loadElementsForSubject();
    }
  }

  loadElementsForSubject(): void {
    if (!this.selectedExamSetId || !this.selectedSubjectId) return;

    this.loading = true;
    this.marksService.getAssessmentElements(this.selectedExamSetId).subscribe({
      next: (allElements) => {
        console.log('[ManageAssessmentElements] Received elements:', allElements);
        console.log('[ManageAssessmentElements] Filtering for subjectId:', this.selectedSubjectId);
        this.elements = allElements.filter(e => e.subject_id == this.selectedSubjectId); // Using == for loose equality check just in case
        console.log('[ManageAssessmentElements] Filtered elements:', this.elements);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading elements:', err);
        this.snack.open('Failed to load elements', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  getSelectedSubjectName(): string {
    if (!this.selectedSubjectId) return '';
    const subject = this.subjects.find(s => s.subject_id === this.selectedSubjectId);
    return subject?.subject_name || '';
  }

  openAddForm(): void {
    this.newElement = {
      element_name: '',
      max_score: null,
      contributing_weight_percent: null
    };
    this.showAddForm = true;
  }

  closeAddForm(): void {
    this.showAddForm = false;
    this.newElement = {
      element_name: '',
      max_score: null,
      contributing_weight_percent: null
    };
  }

  startEditElement(element: AssessmentElement): void {
    this.editingElementId = element.element_id;
    this.editingElement = {
      element_name: element.element_name,
      max_score: element.max_score,
      contributing_weight_percent: element.contributing_weight_percent
    };
  }

  cancelEditElement(): void {
    this.editingElementId = null;
    this.editingElement = {
      element_name: '',
      max_score: null,
      contributing_weight_percent: null
    };
  }

  saveNewElement(): void {
    if (!this.validateNewElement()) return;
    if (!this.selectedExamSetId || !this.selectedSubjectId) {
      this.snack.open('Please select exam set and subject', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    const element: AssessmentElement = {
      element_id: 0,
      exam_set_id: this.selectedExamSetId,
      subject_id: this.selectedSubjectId,
      school_id: this.schoolId,
      element_name: this.newElement.element_name,
      max_score: this.newElement.max_score!,
      contributing_weight_percent: this.newElement.contributing_weight_percent!,
      subject_name: '',
      created_at: new Date().toISOString()
    };

    this.marksService.createAssessmentElement(element).subscribe({
      next: () => {
        this.snack.open('Assessment element added successfully', 'Close', { duration: 3000 });
        this.closeAddForm();
        this.loadElementsForSubject();
        this.saving = false;
      },
      error: (err) => {
        console.error('Error creating element:', err);
        this.snack.open('Failed to create assessment element', 'Close', { duration: 3000 });
        this.saving = false;
      }
    });
  }

  saveEditElement(element: AssessmentElement): void {
    if (!this.validateEditElement()) return;

    this.saving = true;
    const updatedElement: AssessmentElement = {
      ...element,
      element_name: this.editingElement.element_name,
      max_score: this.editingElement.max_score!,
      contributing_weight_percent: this.editingElement.contributing_weight_percent!
    };

    this.marksService.updateAssessmentElement(updatedElement).subscribe({
      next: () => {
        this.snack.open('Assessment element updated successfully', 'Close', { duration: 3000 });
        this.cancelEditElement();
        this.loadElementsForSubject();
        this.saving = false;
      },
      error: (err) => {
        console.error('Error updating element:', err);
        this.snack.open('Failed to update assessment element', 'Close', { duration: 3000 });
        this.saving = false;
      }
    });
  }

  deleteElement(element: AssessmentElement): void {
    if (!confirm(`Are you sure you want to delete "${element.element_name}"? This cannot be undone.`)) {
      return;
    }

    this.saving = true;
    this.marksService.deleteAssessmentElement(element.element_id).subscribe({
      next: () => {
        this.snack.open('Assessment element deleted successfully', 'Close', { duration: 3000 });
        this.loadElementsForSubject();
        this.saving = false;
      },
      error: (err) => {
        console.error('Error deleting element:', err);
        this.snack.open('Failed to delete assessment element', 'Close', { duration: 3000 });
        this.saving = false;
      }
    });
  }

  private validateNewElement(): boolean {
    if (!this.newElement.element_name?.trim()) {
      this.snack.open('Element name is required', 'Close', { duration: 3000 });
      return false;
    }
    if (this.newElement.max_score === null || this.newElement.max_score <= 0) {
      this.snack.open('Max score must be greater than 0', 'Close', { duration: 3000 });
      return false;
    }
    if (this.newElement.contributing_weight_percent === null || this.newElement.contributing_weight_percent < 0 || this.newElement.contributing_weight_percent > 100) {
      this.snack.open('Weight percentage must be between 0 and 100', 'Close', { duration: 3000 });
      return false;
    }
    return true;
  }

  private validateEditElement(): boolean {
    if (!this.editingElement.element_name?.trim()) {
      this.snack.open('Element name is required', 'Close', { duration: 3000 });
      return false;
    }
    if (this.editingElement.max_score === null || this.editingElement.max_score <= 0) {
      this.snack.open('Max score must be greater than 0', 'Close', { duration: 3000 });
      return false;
    }
    if (this.editingElement.contributing_weight_percent === null || this.editingElement.contributing_weight_percent < 0 || this.editingElement.contributing_weight_percent > 100) {
      this.snack.open('Weight percentage must be between 0 and 100', 'Close', { duration: 3000 });
      return false;
    }
    return true;
  }

  getTotalWeight(): number {
    return this.elements.reduce((sum, el) => sum + el.contributing_weight_percent, 0);
  }

  goBack(): void {
    this.router.navigate(['/marks']);
  }
}
