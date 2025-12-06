
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MarksService, ExamSet, AssessmentElement } from '../../services/marks.service';
import { StudentService } from '../../services/student.service';
import { SchoolService } from '../../services/school.service';
import { StaffService } from '../../services/staff.service';
import { AuthService } from '../../services/auth.service';
import { PdfExportService } from '../../services/pdf-export.service';

interface Subject {
    subject_id: number;
    subject_name: string;
}

interface StudentMarkRow {
    student_id: number;
    student_name: string;
    reg_number: string;
    mark: number | null;
    markDirty: boolean;
}

@Component({
    selector: 'app-teacher-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, MatSnackBarModule],
    templateUrl: './teacher-dashboard.component.html',
    styleUrls: ['./teacher-dashboard.component.scss']
})
export class TeacherDashboardComponent implements OnInit {
    schoolId: number = 0;
    schoolName: string = '';
    staffId: number = 0;

    // Assignments Data
    mySubjects: any[] = [];
    myClasses: any[] = []; // Only for class teachers

    // Filters
    availableClasses: string[] = []; // Derived from assignments
    selectedClass: string = '';

    years: number[] = [];
    selectedYear: number = new Date().getFullYear();

    examSets: ExamSet[] = [];
    selectedExamSetId: number | null = null;

    subjects: Subject[] = [];
    selectedSubjectId: number | null = null;

    assessmentElements: AssessmentElement[] = [];
    filteredElements: AssessmentElement[] = [];
    selectedElementId: number | null = null;
    selectedElement: AssessmentElement | null = null;

    // Data
    allStudents: StudentMarkRow[] = [];
    students: StudentMarkRow[] = [];
    searchTerm: string = '';

    loading = false;
    saving = false;
    hasChanges = false;

    private router = inject(Router);
    private marksService = inject(MarksService);
    private studentService = inject(StudentService);
    private schoolService = inject(SchoolService);
    private staffService = inject(StaffService);
    private authService = inject(AuthService);
    private snack = inject(MatSnackBar);
    private pdfExportService = inject(PdfExportService);

    // Pagination
    currentPage = 0;
    pageSize = 50;
    paginatedStudents: StudentMarkRow[] = [];

    get totalPages(): number {
        return Math.max(1, Math.ceil(this.students.length / this.pageSize));
    }

    get displayedStudents(): StudentMarkRow[] {
        const start = this.currentPage * this.pageSize;
        return this.students.slice(start, start + this.pageSize);
    }

    nextPage(): void {
        if (this.currentPage < this.totalPages - 1) {
            this.currentPage++;
        }
    }

    prevPage(): void {
        if (this.currentPage > 0) {
            this.currentPage--;
        }
    }

    changePageSize(size: number): void {
        this.pageSize = size;
        this.currentPage = 0;
    }

    ngOnInit(): void {
        const user = this.authService.currentUserValue;
        if (!user || !user.school_id) {
            this.router.navigate(['/login']);
            return;
        }

        this.schoolId = user.school_id;
        this.staffId = user.userId; // Assuming userId maps to staffId for staff users

        // Load School Details for PDF
        this.schoolService.getMySchool().subscribe(school => {
            if (school) this.schoolName = school.school_name;
        });

        this.generateYearsList();
        this.loadMyAssignments();
    }

    generateYearsList(): void {
        const currentYear = new Date().getFullYear();
        this.years = [];
        for (let i = 0; i < 5; i++) {
            this.years.unshift(currentYear - i);
        }
    }

    loadMyAssignments(): void {
        this.loading = true;
        this.staffService.getStaffAssignments(this.staffId, this.schoolId).subscribe({
            next: (data) => {
                this.mySubjects = data.subjects;
                this.myClasses = data.classes;

                // Extract unique classes from Subject Assignments AND Class Teacher Roles?
                // Usually teachers want to enter marks for subjects they teach.
                const subjectClasses = this.mySubjects.map(s => s.class_level);
                const roleClasses = this.myClasses.map(c => c.class_name);

                // Determine what classes allow marks entry. 
                // Typically a subject teacher enters marks for that subject in that class.
                // A class teacher might oversee everything, but data entry is usually per subject.
                // For now, we list classes where they have at least one subject assigned.
                this.availableClasses = [...new Set(subjectClasses)].sort();

                this.loading = false;
            },
            error: (err) => {
                console.error('Failed to load assignments', err);
                this.snack.open('Failed to load your assignments', 'Close', { duration: 3000 });
                this.loading = false;
            }
        });
    }

    onClassChange(): void {
        this.selectedExamSetId = null;
        this.selectedSubjectId = null;
        this.selectedElementId = null;
        this.examSets = [];
        this.subjects = [];
        this.filteredElements = [];
        this.allStudents = [];
        this.students = [];
        this.searchTerm = '';

        if (this.selectedClass) {
            this.loadExamSets();

            // Filter subjects for this class based on assignments
            const assignedSubjectsForClass = this.mySubjects.filter(s => s.class_level === this.selectedClass);

            this.subjects = assignedSubjectsForClass.map(s => ({
                subject_id: s.subject_id,
                subject_name: s.subject_name
            })).sort((a, b) => a.subject_name.localeCompare(b.subject_name));
        }
    }

    onYearChange(): void {
        // Reset dependant validations if needed, usually just re-fetch exam sets
        this.onClassChange();
    }

    loadExamSets(): void {
        this.loading = true;
        const filters: any = {
            class_level: this.selectedClass,
            year: this.selectedYear
        };

        this.marksService.getExamSets(this.schoolId, filters).subscribe({
            next: (data) => {
                this.examSets = data;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading exam sets:', err);
                this.loading = false;
            }
        });
    }

    onExamSetChange(examSetId: number): void {
        this.selectedExamSetId = examSetId;
        this.selectedElementId = null;
        this.filteredElements = [];
        this.allStudents = [];
        this.students = [];

        // Subject is already selected? No, user selects subject next.
        // Wait, in previous flow user selects Exam Set -> Then Subject? 
        // In strict hierarchy: Class -> Year -> Exam Set -> Subject -> Element.
        // My assignments determine the SUBJECTS list.

        // We already populated `this.subjects` in `onClassChange`.
        // But we need to load elements to know which ones exist for this Exam Set + Subject.

        // Actually, elements depend on ExamSet AND Subject.
        // So we don't load elements yet until subject is picked?
        // OR we load all elements for the exam set and filter.
        if (examSetId) {
            this.loadAllElementsForExamSet(examSetId);
        }
    }

    loadAllElementsForExamSet(examSetId: number): void {
        // We load elements to verify they exist, but we filter by the user's selected subject
        this.marksService.getAssessmentElements(examSetId).subscribe({
            next: (elements) => {
                this.assessmentElements = elements;
                // We don't change `this.subjects` derived from assignments, 
                // BUT we probably should visually indicate if an "assigned subject" has no "assessment elements" configured yet.
                // For now, keep it simple.
            }
        });
    }

    onSubjectChange(subjectId: number): void {
        this.selectedSubjectId = subjectId;
        this.selectedElementId = null;
        this.allStudents = [];
        this.students = [];

        if (subjectId) {
            // Filter elements for this subject
            this.filteredElements = this.assessmentElements.filter(e => e.subject_id == subjectId);
        } else {
            this.filteredElements = [];
        }
    }

    onElementChange(elementId: number): void {
        this.selectedElementId = elementId;
        this.selectedElement = this.assessmentElements.find(e => e.element_id == elementId) || null;

        if (elementId) {
            this.loadStudentsAndMarks();
        }
    }

    loadStudentsAndMarks(): void {
        if (!this.selectedClass || !this.selectedExamSetId || !this.selectedElementId) return;

        this.loading = true;

        // Load students for the class
        this.studentService.getStudents(this.schoolId, undefined, this.selectedClass).subscribe({
            next: (response) => {
                const items = Array.isArray(response) ? response : (response as any).items || [];
                this.allStudents = items.map((student: any) => ({
                    student_id: student.student_id,
                    student_name: student.student_name,
                    reg_number: student.reg_number,
                    mark: null,
                    markDirty: false
                }));

                this.filterStudents();

                // Load Marks
                this.marksService.getExamSetResults(this.selectedExamSetId!).subscribe({
                    next: (results) => {
                        results.forEach((result: any) => {
                            if (result.element_id == this.selectedElementId) {
                                const student = this.allStudents.find(s => s.student_id === result.student_id);
                                if (student) {
                                    student.mark = result.score_obtained;
                                }
                            }
                        });
                        this.loading = false;
                    },
                    error: (err) => {
                        console.error(err);
                        this.loading = false;
                    }
                });
            }
        });
    }

    filterStudents(): void {
        if (!this.searchTerm) {
            this.students = [...this.allStudents];
        } else {
            const term = this.searchTerm.toLowerCase();
            this.students = this.allStudents.filter(s =>
                s.student_name.toLowerCase().includes(term) ||
                s.reg_number.toLowerCase().includes(term)
            );
        }
        this.currentPage = 0; // Reset to first page
    }

    onMarkChange(student: StudentMarkRow): void {
        student.markDirty = true;
        this.hasChanges = true;
    }

    saveAllMarks(): void {
        if (!this.selectedExamSetId || !this.selectedElementId) return;

        this.saving = true;
        const entries = [];

        for (const student of this.allStudents) {
            if (student.markDirty && student.mark !== null && student.mark !== undefined) {
                entries.push({
                    student_identifier: student.reg_number,
                    identifier_type: 'reg_number',
                    marks: [{
                        element_id: this.selectedElementId,
                        score_obtained: student.mark
                    }]
                });
            }
        }

        if (entries.length === 0) {
            this.snack.open('No changes to save', 'Close', { duration: 3000 });
            this.saving = false;
            return;
        }

        this.marksService.bulkUploadMarks(this.selectedExamSetId, this.schoolId, entries as any).subscribe({
            next: (result) => {
                this.saving = false;
                this.hasChanges = false;
                this.snack.open(`Marks saved! ${result.success} records processed.`, 'Close', { duration: 3000 });
                this.allStudents.forEach(s => s.markDirty = false);
            },
            error: (err) => {
                console.error('Error saving marks:', err);
                this.snack.open('Failed to save marks', 'Close', { duration: 3000 });
                this.saving = false;
            }
        });
    }
    downloadPdf(): void {
        if (!this.selectedClass || !this.selectedExamSetId || !this.selectedElementId) {
            this.snack.open('Please select all filters to download PDF', 'Close', { duration: 3000 });
            return;
        }

        const examSet = this.examSets.find(e => e.exam_set_id == this.selectedExamSetId); // Loose equality just in case of string/number mismatch from select
        const subjectName = this.subjects.find(s => s.subject_id == this.selectedSubjectId)?.subject_name || '-';
        const elementName = this.selectedElement ? `${this.selectedElement.element_name} (Max: ${this.selectedElement.max_score})` : '-';

        // Get badge URL from local storage
        let badgeUrl: string | undefined;
        try {
            const schoolData = localStorage.getItem('bigezo_selected_school');
            if (schoolData) {
                const school = JSON.parse(schoolData);
                badgeUrl = school?.badge_url;
            }
        } catch { }

        const data = this.students.map(s => ({
            reg: s.reg_number,
            name: s.student_name,
            mark: (s.mark !== null && s.mark !== undefined) ? s.mark : 'MISSING'
        }));

        this.pdfExportService.generateMarksListPDF(data, {
            schoolName: this.schoolName || 'School Registry',
            className: this.selectedClass,
            subjectName: subjectName,
            examSetName: examSet ? `${examSet.set_name} (${examSet.year})` : '-',
            elementName: elementName,
            generatedDate: new Date().toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }),
            badgeUrl: badgeUrl
        }).then(() => {
            this.snack.open('PDF downloaded successfully', 'Close', { duration: 3000 });
        }).catch(err => {
            console.error('Error generating PDF:', err);
            this.snack.open('Failed to generate PDF', 'Close', { duration: 3000 });
        });
    }
}
