import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MarksService, ExamSet, AssessmentElement } from '../../services/marks.service';
import { StudentService, Student } from '../../services/student.service';
import { SchoolService } from '../../services/school.service';
import { ClassCategorizationService } from '../../services/class-categorization.service';

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
  selector: 'app-student-marks-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './student-marks-viewer.component.html',
  styleUrls: ['./student-marks-viewer.component.scss']
})
export class StudentMarksViewerComponent implements OnInit {
  schoolId: number = 0;

  // Filters
  classes: string[] = [];
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

  constructor(
    private router: Router,
    private marksService: MarksService,
    private studentService: StudentService,
    private schoolService: SchoolService,
    private classCategorizationService: ClassCategorizationService,
    private snack: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.schoolService.getMySchool().subscribe({
      next: (school) => {
        if (school) {
          this.schoolId = school.school_id;
          this.loadClasses();
          this.generateYearsList();
        }
      },
      error: (err) => console.error('Error loading school:', err)
    });
  }

  loadClasses(): void {
    try {
      const schoolType = this.schoolService.getSelectedSchoolType();
      if (schoolType) {
        this.classes = this.classCategorizationService.getClassesForSchoolType(schoolType);
      }
    } catch (err) {
      console.error('Error loading classes:', err);
      this.classes = [];
    }
  }

  generateYearsList(): void {
    const currentYear = new Date().getFullYear();
    this.years = [];
    for (let i = 0; i < 5; i++) {
      this.years.unshift(currentYear - i);
    }
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
    }
  }

  onYearChange(): void {
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
    }
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
        this.snack.open('Failed to load exam sets', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  onExamSetChange(examSetId: number): void {
    this.selectedExamSetId = examSetId;
    this.selectedSubjectId = null;
    this.selectedElementId = null;
    this.subjects = [];
    this.filteredElements = [];
    this.allStudents = [];
    this.students = [];
    this.searchTerm = '';

    if (examSetId) {
      this.loadSubjectsAndElements();
    }
  }

  loadSubjectsAndElements(): void {
    if (!this.selectedExamSetId) return;

    this.loading = true;
    this.marksService.getAssessmentElements(this.selectedExamSetId).subscribe({
      next: (elements) => {
        this.assessmentElements = elements;

        // Group elements by subject
        const subjectMap = new Map<number, Subject>();
        elements.forEach(el => {
          if (!subjectMap.has(el.subject_id)) {
            subjectMap.set(el.subject_id, {
              subject_id: el.subject_id,
              subject_name: el.subject_name || el.element_name.split(' - ')[0] || `Subject ${el.subject_id}`
            });
          }
        });
        this.subjects = Array.from(subjectMap.values()).sort((a, b) => a.subject_name.localeCompare(b.subject_name));
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading assessment elements:', err);
        this.snack.open('Failed to load subjects', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  onSubjectChange(subjectId: number): void {
    this.selectedSubjectId = subjectId;
    this.selectedElementId = null;
    this.allStudents = [];
    this.students = [];
    this.searchTerm = '';

    if (subjectId) {
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
    } else {
      this.allStudents = [];
      this.students = [];
      this.searchTerm = '';
    }
  }

  loadStudentsAndMarks(): void {
    if (!this.selectedClass || !this.selectedExamSetId || !this.selectedElementId) return;

    this.loading = true;
    console.log(`[ViewMarks] loadStudentsAndMarks started. Class: ${this.selectedClass}, ExamSet: ${this.selectedExamSetId}, Element: ${this.selectedElementId}`);

    // Load students
    this.studentService.getStudents(this.schoolId, undefined, this.selectedClass).subscribe({
      next: (response) => {
        const items = Array.isArray(response) ? response : (response as any).items || [];
        console.log(`[ViewMarks] Loaded ${items.length} students`);

        // Initialize students with empty marks
        this.allStudents = items.map((student: any) => ({
          student_id: student.student_id,
          student_name: student.student_name,
          reg_number: student.reg_number,
          mark: null,
          markDirty: false
        }));

        // Initial filter
        this.filterStudents();

        // Load existing marks for this exam set
        console.log(`[ViewMarks] Fetching marks for examSet: ${this.selectedExamSetId}`);
        this.marksService.getExamSetResults(this.selectedExamSetId!).subscribe({
          next: (results) => {
            console.log(`[ViewMarks] Received ${results.length} mark entries from backend`);
            let matchedCount = 0;

            if (results.length > 0) {
              console.log('[ViewMarks] First result sample:', results[0]);
              console.log(`[ViewMarks] Current selectedElementId: ${this.selectedElementId} (Type: ${typeof this.selectedElementId})`);
            }

            results.forEach((result: any) => {
              // Debug log for first few results to check types
              if (matchedCount < 3 && result.element_id == this.selectedElementId) {
                console.log(`[ViewMarks] Match found! student_id=${result.student_id}, score=${result.score_obtained}`);
              }

              // Ensure loose equality or correct type conversion
              if (result.element_id == this.selectedElementId) {
                const student = this.allStudents.find(s => s.student_id === result.student_id);
                if (student) {
                  student.mark = result.score_obtained;
                  matchedCount++;
                } else {
                  // Log if we have a mark for a student not in the current list (might happen if filtering classes differently)
                  // console.warn(`[ViewMarks] Found mark for student_id ${result.student_id} but student not in current list`);
                }
              }
            });
            console.log(`[ViewMarks] Matched ${matchedCount} marks for current element out of ${results.length} total results`);
            this.loading = false;
          },
          error: (err) => {
            console.error('Error loading marks:', err);
            this.loading = false;
          }
        });
      },
      error: (err) => {
        console.error('Error loading students:', err);
        this.snack.open('Failed to load students', 'Close', { duration: 3000 });
        this.loading = false;
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
  }

  onMarkChange(student: StudentMarkRow): void {
    student.markDirty = true;
    this.hasChanges = true;
  }

  saveSingleMark(student: StudentMarkRow): void {
    if (!this.selectedExamSetId || !this.selectedElementId) return;

    if (student.mark === null || student.mark === undefined) {
      this.snack.open('Please enter a valid mark', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    const entry = {
      student_identifier: student.reg_number,
      identifier_type: 'reg_number',
      marks: [{
        element_id: this.selectedElementId,
        score_obtained: student.mark
      }]
    };

    this.marksService.bulkUploadMarks(this.selectedExamSetId, this.schoolId, [entry as any]).subscribe({
      next: (result) => {
        this.saving = false;

        if (result.success > 0) {
          student.markDirty = false;
          // Check if any other students are dirty
          this.hasChanges = this.allStudents.some(s => s.markDirty);
          this.snack.open('Mark saved successfully', 'Close', { duration: 2000 });
        } else {
          console.error('Save failed:', result.errors);
          const errorMsg = result.errors.length > 0 ? result.errors[0].error : 'Unknown error';
          this.snack.open(`Failed to save: ${errorMsg}`, 'Close', { duration: 5000 });
        }
      },
      error: (err) => {
        console.error('Error saving mark:', err);
        this.snack.open('Failed to save mark', 'Close', { duration: 3000 });
        this.saving = false;
      }
    });
  }

  saveAllMarks(): void {
    if (!this.selectedExamSetId || !this.selectedElementId) {
      this.snack.open('Please select an exam set and element', 'Close', { duration: 3000 });
      return;
    }

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

        // Reset dirty flags
        this.allStudents.forEach(s => {
          s.markDirty = false;
        });
      },
      error: (err) => {
        console.error('Error saving marks:', err);
        this.snack.open('Failed to save marks', 'Close', { duration: 3000 });
        this.saving = false;
      }
    });
  }

  generateStudentReport(studentId: number): void {
    if (this.selectedExamSetId) {
      this.router.navigate(['/marks/student-report', this.selectedExamSetId, studentId]);
    }
  }

  goBack(): void {
    this.router.navigate(['/marks']);
  }

  downloadPdf(): void {
    if (!this.selectedClass || !this.selectedExamSetId || !this.selectedElementId) {
      this.snack.open('Please select all filters to download PDF', 'Close', { duration: 3000 });
      return;
    }

    import('jspdf').then(jsPDF => {
      import('jspdf-autotable').then(autoTable => {
        const doc = new jsPDF.default();

        // Colors
        const primaryColor = [41, 128, 185]; // Blue
        const blackColor = [0, 0, 0];
        const whiteColor = [255, 255, 255];

        // --- Header Section ---
        // Logo Placeholder (Left)
        doc.setDrawColor(200);
        doc.setFillColor(240, 240, 240);
        doc.rect(14, 15, 30, 30, 'FD'); // x, y, w, h
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Logo', 29, 32, { align: 'center' });

        // School Name & Title (Center/Right)
        doc.setTextColor(0);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('SCHOOL NAME HERE', 105, 25, { align: 'center' }); // Placeholder for dynamic school name if available

        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.text('Student Marks List', 105, 35, { align: 'center' });

        // Info Box (Below Header)
        const startY = 50;
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(14, 48, 196, 48); // Top line

        doc.setFontSize(11);
        doc.setTextColor(0);

        // Left Column
        doc.setFont('helvetica', 'bold');
        doc.text('Class:', 14, 55);
        doc.setFont('helvetica', 'normal');
        doc.text(this.selectedClass, 40, 55);

        doc.setFont('helvetica', 'bold');
        doc.text('Subject:', 14, 62);
        doc.setFont('helvetica', 'normal');
        const subjectName = this.subjects.find(s => s.subject_id === this.selectedSubjectId)?.subject_name || '-';
        doc.text(subjectName, 40, 62);

        // Right Column
        doc.setFont('helvetica', 'bold');
        doc.text('Exam Set:', 110, 55);
        doc.setFont('helvetica', 'normal');
        const examSet = this.examSets.find(e => e.exam_set_id === this.selectedExamSetId);
        const examSetName = examSet ? `${examSet.set_name} (${examSet.year})` : '-';
        doc.text(examSetName, 140, 55);

        doc.setFont('helvetica', 'bold');
        doc.text('Assessment:', 110, 62);
        doc.setFont('helvetica', 'normal');
        const elementName = this.selectedElement ? `${this.selectedElement.element_name} (Max: ${this.selectedElement.max_score})` : '-';
        doc.text(elementName, 140, 62);

        doc.line(14, 66, 196, 66); // Bottom line

        // --- Table Data ---
        const tableData = this.students.map(student => {
          const hasMark = student.mark !== null && student.mark !== undefined;
          return [
            student.reg_number,
            student.student_name,
            hasMark ? student.mark : 'MISSING'
          ];
        });

        // --- Generate Table ---
        (autoTable.default as any)(doc, {
          head: [['Reg Number', 'Student Name', 'Mark Obtained']],
          body: tableData,
          startY: 75,
          theme: 'grid',
          headStyles: {
            fillColor: primaryColor,
            textColor: whiteColor,
            fontStyle: 'bold',
            lineWidth: 0.1,
            lineColor: blackColor
          },
          bodyStyles: {
            textColor: blackColor,
            lineWidth: 0.1,
            lineColor: blackColor
          },
          styles: {
            fontSize: 10,
            cellPadding: 4,
            valign: 'middle'
          },
          didParseCell: (data: any) => {
            if (data.section === 'body') {
              const markValue = data.row.raw[2];
              if (markValue === 'MISSING') {
                data.cell.styles.fillColor = [253, 237, 236]; // Light Red background
                data.cell.styles.textColor = [192, 57, 43];   // Dark Red text
                data.cell.styles.fontStyle = 'bold';
              } else {
                data.cell.styles.fillColor = [233, 247, 239]; // Light Green background
                data.cell.styles.textColor = [25, 111, 61];   // Dark Green text
              }
            }
          }
        });

        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(`Page ${i} of ${pageCount}`, 196, 290, { align: 'right' });
          doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 290);
        }

        // Save
        const fileName = `Marks_${this.selectedClass}_${this.selectedElement?.element_name || 'List'}.pdf`;
        doc.save(fileName);
      });
    });
  }
}
