import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { StudentService } from '../../services/student.service';
import { SchoolService } from '../../services/school.service';

@Component({
    selector: 'app-promotions',
    standalone: true,
    imports: [
        CommonModule, FormsModule, ReactiveFormsModule,
        MatCardModule, MatButtonModule, MatFormFieldModule, MatSelectModule, MatInputModule, MatCheckboxModule, MatSnackBarModule
    ],
    templateUrl: './promotions.component.html',
    styleUrls: ['./promotions.component.scss']
})
export class PromotionsComponent implements OnInit {
    schoolId: number | null = null;

    // Hardcoded classes matching DB migration
    classes = [
        { id: 14, name: 'Baby Class' }, { id: 15, name: 'Middle Class' }, { id: 16, name: 'Top Class' },
        { id: 1, name: 'P.1' }, { id: 2, name: 'P.2' }, { id: 3, name: 'P.3' }, { id: 4, name: 'P.4' }, { id: 5, name: 'P.5' }, { id: 6, name: 'P.6' }, { id: 7, name: 'P.7' },
        { id: 8, name: 'S.1' }, { id: 9, name: 'S.2' }, { id: 10, name: 'S.3' }, { id: 11, name: 'S.4' }, { id: 12, name: 'S.5' }, { id: 13, name: 'S.6' }
    ];

    years: number[] = [];

    // Source Filters
    sourceYear: number = new Date().getFullYear();
    sourceClassId: number | null = null;

    // Destination Details
    destYear: number = new Date().getFullYear() + 1;
    destTerm: number = 1;
    destClassId: number | null = null;

    // Data
    students: any[] = [];
    selectedStudentIds: Set<number> = new Set();

    loading = false;
    promoting = false;

    constructor(
        private studentService: StudentService,
        private schoolService: SchoolService,
        private snackBar: MatSnackBar
    ) {
        const current = new Date().getFullYear();
        this.years = [current - 2, current - 1, current, current + 1, current + 2];
    }

    ngOnInit() {
        this.schoolId = this.schoolService.getSelectedSchoolId();
    }

    onFilterChange() {
        if (this.schoolId && this.sourceYear && this.sourceClassId) {
            this.fetchStudents();
        }
    }

    fetchStudents() {
        if (!this.schoolId || !this.sourceClassId) return;
        this.loading = true;
        this.selectedStudentIds.clear();

        this.studentService.getPromotableStudents(this.schoolId, this.sourceYear, this.sourceClassId)
            .subscribe({
                next: (data) => {
                    this.students = data;
                    this.loading = false;
                },
                error: (err) => {
                    console.error(err);
                    this.loading = false;
                    this.snackBar.open('Failed to load students', 'Close', { duration: 3000 });
                }
            });
    }

    toggleAll(event: any) {
        if (event.checked) {
            this.students.forEach(s => this.selectedStudentIds.add(s.student_id));
        } else {
            this.selectedStudentIds.clear();
        }
    }

    toggleStudent(studentId: number, event: any) {
        if (event.checked) {
            this.selectedStudentIds.add(studentId);
        } else {
            this.selectedStudentIds.delete(studentId);
        }
    }

    isAllSelected(): boolean {
        return this.students.length > 0 && this.selectedStudentIds.size === this.students.length;
    }

    isDisabled(): boolean {
        return this.selectedStudentIds.size === 0 || !this.destClassId || !this.destYear || !this.destTerm;
    }

    promote() {
        if (!this.schoolId || this.isDisabled()) return;

        if (!confirm(`Are you sure you want to promote ${this.selectedStudentIds.size} students?`)) return;

        this.promoting = true;
        const payload = {
            schoolId: this.schoolId,
            studentIds: Array.from(this.selectedStudentIds),
            nextClassId: this.destClassId!,
            nextYear: this.destYear,
            nextTerm: this.destTerm
        };

        this.studentService.promoteStudents(payload).subscribe({
            next: (res) => {
                this.promoting = false;
                this.snackBar.open(`Successfully promoted ${res.count} students!`, 'Close', { duration: 5000 });
                this.selectedStudentIds.clear();
                this.fetchStudents(); // Refresh list (they remain in source list until year changes or we filter differently)
                // Ideally they disappear if we filter by "Status=Active" and their status changed in that year?
                // Wait, their status in SOURCE year (e.g. 2024) remains 'Active'.
                // But we added a record for 2025.
                // So they are still in the list. That's fine.
            },
            error: (err) => {
                console.error(err);
                this.promoting = false;
                this.snackBar.open('Promotion failed. ' + (err.error?.message || ''), 'Close', { duration: 5000 });
            }
        });
    }
}
