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
}
