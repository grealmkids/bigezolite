import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StaffService } from '../../../services/staff.service';

@Component({
    selector: 'app-staff-view-assignments-dialog',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
    templateUrl: './staff-view-assignments-dialog.component.html',
    styleUrls: ['./staff-view-assignments-dialog.component.scss']
})
export class StaffViewAssignmentsDialogComponent implements OnInit {
    assignments: { subjects: any[], classes: any[] } = { subjects: [], classes: [] };
    isLoading = true;

    private staffService = inject(StaffService);

    constructor(
        public dialogRef: MatDialogRef<StaffViewAssignmentsDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { staffId: number, schoolId: number, staffName: string }
    ) { }

    ngOnInit(): void {
        this.loadAssignments();
    }

    loadAssignments(): void {
        this.isLoading = true;
        this.staffService.getStaffAssignments(this.data.staffId, this.data.schoolId).subscribe({
            next: (data) => {
                this.assignments = data;
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Failed to load assignments', err);
                this.isLoading = false;
            }
        });
    }

    deleteAssignment(id: number, type: 'subject' | 'class'): void {
        if (confirm('Are you sure you want to remove this assignment?')) {
            this.isLoading = true;
            const obs$ = type === 'subject'
                ? this.staffService.deleteSubjectAssignment(id, this.data.schoolId)
                : this.staffService.deleteClassAssignment(id, this.data.schoolId);

            obs$.subscribe({
                next: () => {
                    this.loadAssignments(); // Reload list
                },
                error: (err) => {
                    console.error('Delete failed', err);
                    alert('Failed to delete assignment.');
                    this.isLoading = false;
                }
            });
        }
    }
}
