import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SchoolService } from '../../services/school.service';
import { FeesToTrackService, FeeToTrack } from '../../services/fees-to-track.service';

@Component({
  selector: 'app-fees-to-track',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './fees-to-track.component.html',
  styleUrls: []
})
export class FeesToTrackComponent implements OnInit {
  private snack = inject(MatSnackBar);
  private svc = inject(FeesToTrackService);
  private schoolService = inject(SchoolService);

  items: FeeToTrack[] = [];
  isLoading = false;

  // form
  name = '';
  description = '';
  total_due: number | null = null;
  term: number = 1;
  year: number = new Date().getFullYear();
  class_name: string = 'All';
  due_date: string = '';

  classes: string[] = [];

  ngOnInit(): void {
    try { this.classes = this.schoolService.getSelectedSchoolType() ? [] : []; } catch {}
    this.reload();
  }

  reload(): void {
    const schoolId = this.schoolService.getSelectedSchoolId();
    if (!schoolId) { this.items = []; return; }
    this.isLoading = true;
    this.svc.list(schoolId).subscribe({
      next: (rows) => { this.items = rows || []; this.isLoading = false; },
      error: (err) => { this.isLoading = false; this.snack.open(err?.error?.message || 'Failed to load fees to track', 'Close', { duration: 4000, panelClass: ['error-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' }); }
    });
  }

  create(): void {
    const schoolId = this.schoolService.getSelectedSchoolId();
    if (!schoolId) { this.snack.open('Select a school first', 'Close', { duration: 3000 }); return; }
    if (!this.name || !this.total_due || !this.term || !this.year || !this.due_date) {
      this.snack.open('Please fill in name, total due, term, year and due date', 'Close', { duration: 3000, panelClass: ['error-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' });
      return;
    }
    const payload = { name: this.name, description: this.description || undefined, total_due: this.total_due, term: this.term, year: this.year, class_name: this.class_name === 'All' ? null : this.class_name, due_date: this.due_date };
    this.svc.create(schoolId, payload).subscribe({
      next: () => { this.snack.open('Fee created and applied to students', 'Close', { duration: 3000, panelClass: ['success-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' }); this.resetForm(); this.reload(); },
      error: (err) => { this.snack.open(err?.error?.message || 'Failed to create fee', 'Close', { duration: 4000, panelClass: ['error-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' }); }
    });
  }

  delete(item: FeeToTrack): void {
    if (!confirm(`Delete fee "${item.name}"? All associated fee records will be removed.`)) return;
    this.svc.delete(item.fee_id).subscribe({
      next: () => { this.snack.open('Fee deleted', 'Close', { duration: 2500, panelClass: ['success-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' }); this.reload(); },
      error: (err) => { this.snack.open(err?.error?.message || 'Failed to delete fee', 'Close', { duration: 4000, panelClass: ['error-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' }); }
    });
  }

  resetForm(): void {
    this.name = '';
    this.description = '';
    this.total_due = null;
    this.term = 1;
    this.year = new Date().getFullYear();
    this.class_name = 'All';
    this.due_date = '';
  }
}
