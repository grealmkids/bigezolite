import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SchoolService, School } from '../../services/school.service';

@Component({
  selector: 'app-manage-school',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="manage-school">
      <h2>Manage School</h2>
      <div *ngIf="!school">Loading...</div>
      <form *ngIf="school" [formGroup]="schoolForm" (ngSubmit)="onSave()">
        <label>School Name</label>
        <input formControlName="school_name" />
        <label>Admin Phone</label>
        <input formControlName="admin_phone" />
        <label>Location District</label>
        <input formControlName="location_district" />
        <label>Student Count Range</label>
        <input formControlName="student_count_range" />
        <label>School Type</label>
        <input formControlName="school_type" />
        <div>
          <button type="submit">Save</button>
          <button type="button" (click)="onDelete()">Delete School</button>
        </div>
      </form>
    </div>
  `
})
export class ManageSchoolComponent implements OnInit {
  school: School | null = null;
  schoolForm: any;

  constructor(private schoolService: SchoolService, private fb: FormBuilder, private router: Router) {
    this.schoolForm = this.fb.group({
      school_name: [''],
      admin_phone: [''],
      location_district: [''],
      student_count_range: [''],
      school_type: ['']
    });
  }

  ngOnInit(): void {
    this.schoolService.getMySchool().subscribe(s => {
      this.school = s;
      if (s) this.schoolForm.patchValue({
        school_name: s.school_name || '',
        admin_phone: s.admin_phone || '',
        location_district: s.location_district || '',
        student_count_range: s.student_count_range || '',
        school_type: s.school_type || ''
      });
    });
  }

  onSave(): void {
    if (!this.school) return;
    const updates = this.schoolForm.value;
    this.schoolService.updateMySchool(this.school.school_id, updates).subscribe(() => {
      alert('School updated');
    });
  }

  onDelete(): void {
    if (!this.school) return;
    if (!confirm('Are you sure you want to delete this school? This action cannot be undone.')) return;
    this.schoolService.deleteMySchool(this.school.school_id).subscribe(() => {
      alert('School deleted');
      this.router.navigate(['/dashboard']);
    });
  }
}
