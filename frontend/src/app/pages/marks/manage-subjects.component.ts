import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MarksService, Subject } from '../../services/marks.service';
import { ClassCategorizationService } from '../../services/class-categorization.service';
import { SchoolService } from '../../services/school.service';

@Component({
  selector: 'app-manage-subjects',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './manage-subjects.component.html',
  styleUrls: ['./manage-subjects.component.scss']
})
export class ManageSubjectsComponent implements OnInit {
  schoolId: number = 0;
  classes: string[] = [];
  selectedClass: string = '';
  subjects: Subject[] = [];
  loading = false;
  loadingClasses = false;

  newSubject = {
    subject_name: '',
    school_level: '',
    subject_type: 'Compulsory' as const,
    ncdc_reference_name: '',
    max_selections_allowed: 1
  };
  isAddingSubject = false;

  constructor(
    private marksService: MarksService,
    private schoolService: SchoolService,
    private classCategorizationService: ClassCategorizationService,
    private router: Router
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
  }

  onClassChange(): void {
    if (this.selectedClass) {
      this.loadSubjects();
    }
  }

  loadSubjects(): void {
    if (!this.selectedClass) return;
    this.loading = true;
    this.marksService.getSubjects(this.schoolId, this.selectedClass).subscribe({
      next: (data) => {
        this.subjects = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading subjects:', err);
        this.loading = false;
      }
    });
  }

  addSubject(): void {
    if (!this.newSubject.subject_name || !this.selectedClass) {
      alert('Please fill in all required fields');
      return;
    }

    this.isAddingSubject = true;
    const payload = {
      ...this.newSubject,
      school_id: this.schoolId,
      school_level: this.selectedClass
    };

    this.marksService.createSubject(payload).subscribe({
      next: (result) => {
        this.subjects.push(result);
        this.newSubject = {
          subject_name: '',
          school_level: '',
          subject_type: 'Compulsory',
          ncdc_reference_name: '',
          max_selections_allowed: 1
        };
        this.isAddingSubject = false;
        alert('Subject created successfully!');
      },
      error: (err) => {
        console.error('Error creating subject:', err);
        alert('Failed to create subject');
        this.isAddingSubject = false;
      }
    });
  }

  deleteSubject(subjectId: number): void {
    if (!confirm('Are you sure you want to delete this subject?')) return;
    
    this.marksService.deleteSubject(subjectId).subscribe({
      next: () => {
        this.subjects = this.subjects.filter(s => s.subject_id !== subjectId);
        alert('Subject deleted successfully');
      },
      error: (err) => {
        console.error('Error deleting subject:', err);
        alert('Failed to delete subject');
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/marks']);
  }
}
