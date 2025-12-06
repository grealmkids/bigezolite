import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StaffService, Staff } from '../../services/staff.service';
import { AuthService } from '../../services/auth.service'; // To get school_id from user context
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { StaffEditModalComponent } from './staff-edit-modal/staff-edit-modal.component';
import { StaffAssignmentDialogComponent } from './staff-assignment-dialog/staff-assignment-dialog.component';

@Component({
    selector: 'app-staff-list',
    standalone: true,
    imports: [CommonModule, MatTableModule, MatButtonModule, MatIconModule, MatDialogModule],
    templateUrl: './staff-list.component.html',
    styleUrls: ['./staff-list.component.scss']
})
export class StaffListComponent implements OnInit {
    staffList: Staff[] = [];
    displayedColumns: string[] = ['photo', 'name', 'role', 'email', 'phone', 'status', 'actions'];

    private staffService = inject(StaffService);
    // private authService = inject(AuthService); // Need to expose school_id from auth service
    private dialog = inject(MatDialog);

    // Mock schoolId for now until we have a reliable way to get it from AuthService
    // In a real scenario, AuthService should provide the current user's school_id
    schoolId = 1;

    ngOnInit(): void {
        this.loadStaff();
    }

    loadStaff(): void {
        this.staffService.getStaff(this.schoolId).subscribe({
            next: (data) => this.staffList = data,
            error: (err: any) => console.error('Failed to load staff', err)
        });
    }

    openAddStaffModal(): void {
        const dialogRef = this.dialog.open(StaffEditModalComponent, {
            width: '600px',
            data: { schoolId: this.schoolId }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) this.loadStaff();
        });
    }

    openEditStaffModal(staff: Staff): void {
        const dialogRef = this.dialog.open(StaffEditModalComponent, {
            width: '600px',
            data: { staff, schoolId: this.schoolId }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) this.loadStaff();
        });
    }

    openAssignmentDialog(staff: Staff): void {
        this.dialog.open(StaffAssignmentDialogComponent, {
            width: '400px',
            data: { staffId: staff.staff_id, schoolId: this.schoolId }
        });
    }

    deleteStaff(staff: Staff): void {
        if (confirm(`Are you sure you want to delete ${staff.first_name} ${staff.last_name}?`)) {
            if (staff.staff_id) {
                this.staffService.deleteStaff(staff.staff_id, this.schoolId).subscribe({
                    next: () => this.loadStaff(),
                    error: (err: any) => console.error('Failed to delete staff', err)
                });
            }
        }
    }
}
