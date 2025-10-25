import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SchoolService } from '../../services/school.service';
import { FeesToTrackService, FeeToTrack } from '../../services/fees-to-track.service';
import { ClassCategorizationService } from '../../services/class-categorization.service';

@Component({
  selector: 'app-fees-to-track',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './fees-to-track.component.html',
  styles: [`
  .grid-form { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
  @media (min-width: 1024px) { .grid-form { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  .form-field { display: flex; flex-direction: column; }
  .form-field > label { font-weight: 600; margin-bottom: 0.25rem; color: #374151; }
  .form-field > input, .form-field > select { border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.5rem 0.6rem; font-size: 0.95rem; }
  .form-actions { display: flex; align-items: center; justify-content: flex-start; padding-top: 0.25rem; }
  .btn.primary { background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); color: #fff; border: none; padding: 0.55rem 0.9rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .btn.primary:hover { filter: brightness(1.05); }
  `]
})
export class FeesToTrackComponent implements OnInit {
  private snack = inject(MatSnackBar);
  private svc = inject(FeesToTrackService);
  private schoolService = inject(SchoolService);
  private classCategorizationService = inject(ClassCategorizationService);

  items: FeeToTrack[] = [];
  isLoading = false;

  // edit state
  editingId: number | null = null;
  editModel: Partial<FeeToTrack & { due_date: string }> = {};

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
    try {
      const schoolType = this.schoolService.getSelectedSchoolType();
      this.classes = schoolType ? this.classCategorizationService.getClassesForSchoolType(schoolType) : [];
    } catch {}
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
    if (!confirm(`Delete fee \"${item.name}\"? All associated fee records will be removed.`)) return;
    this.svc.delete(item.fee_id).subscribe({
      next: () => { this.snack.open('Fee deleted', 'Close', { duration: 2500, panelClass: ['success-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' }); this.reload(); },
      error: (err) => { this.snack.open(err?.error?.message || 'Failed to delete fee', 'Close', { duration: 4000, panelClass: ['error-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' }); }
    });
  }

  startEdit(item: FeeToTrack): void {
    this.editingId = item.fee_id;
    this.editModel = {
      name: item.name,
      description: item.description,
      total_due: item.total_due,
      term: item.term,
      year: item.year,
      due_date: (item.due_date || '').slice(0, 10)
    } as any;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editModel = {};
  }

  saveEdit(item: FeeToTrack): void {
    if (!this.editingId) return;
    const payload: any = {
      name: this.editModel.name,
      description: this.editModel.description,
      total_due: this.editModel.total_due,
      term: this.editModel.term,
      year: this.editModel.year,
      due_date: this.editModel.due_date
    };
    this.svc.update(item.fee_id, payload).subscribe({
      next: (updated) => {
        this.snack.open('Fee updated', 'Close', { duration: 2500, panelClass: ['success-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' });
        this.editingId = null;
        this.editModel = {};
        this.reload();
      },
      error: (err) => {
        this.snack.open(err?.error?.message || 'Failed to update fee', 'Close', { duration: 4000, panelClass: ['error-snackbar'], verticalPosition: 'top', horizontalPosition: 'center' });
      }
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
