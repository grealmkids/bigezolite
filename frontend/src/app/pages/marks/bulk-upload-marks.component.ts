import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MarksService, ExamSet, AssessmentElement, Subject } from '../../services/marks.service';
import { SchoolService } from '../../services/school.service';
import { ClassCategorizationService } from '../../services/class-categorization.service';

interface BulkMarkEntry {
  student_identifier: string;
  identifier_type: 'lin_number' | 'reg_number';
  marks: { element_id: number; score_obtained: number }[];
}

@Component({
  selector: 'app-bulk-upload-marks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bulk-upload-marks.component.html',
  styleUrls: ['./bulk-upload-marks.component.scss']
})
export class BulkUploadMarksComponent implements OnInit {
  schoolId: number = 0;
  classes: string[] = [];
  selectedClass: string = '';

  examSets: ExamSet[] = [];
  selectedExamSetId: number | null = null;

  subjects: Subject[] = [];
  selectedSubjectId: number | null = null;

  assessmentElements: AssessmentElement[] = [];
  loading = false;
  loadingElements = false;
  uploadResult: { success: number; errors: any[] } | null = null;

  constructor(
    private marksService: MarksService,
    private router: Router,
    private schoolService: SchoolService,
    private classCategorizationService: ClassCategorizationService
  ) { }

  ngOnInit(): void {
    this.schoolService.getMySchool().subscribe({
      next: (school) => {
        if (school) {
          this.schoolId = school.school_id;
          this.loadClasses();
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

  onClassChange(): void {
    if (this.selectedClass) {
      this.loadExamSets();
    }
  }

  loadExamSets(): void {
    this.loading = true;
    this.marksService.getExamSets(this.schoolId, { class_level: this.selectedClass }).subscribe({
      next: (data) => {
        this.examSets = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading exam sets:', err);
        this.examSets = [];
        this.loading = false;
      }
    });
  }

  onExamSetChange(): void {
    if (this.selectedExamSetId) {
      this.loadSubjects();
    }
  }

  loadSubjects(): void {
    if (!this.selectedExamSetId) return;

    this.loading = true;
    // Get assessment elements to find unique subjects
    this.marksService.getAssessmentElements(this.selectedExamSetId).subscribe({
      next: (elements) => {
        // Extract unique subjects from elements
        const uniqueSubjectsMap = new Map<number, AssessmentElement>();
        elements.forEach(el => {
          if (!uniqueSubjectsMap.has(el.subject_id)) {
            uniqueSubjectsMap.set(el.subject_id, el);
          }
        });
        this.subjects = Array.from(uniqueSubjectsMap.values()).map(el => ({
          subject_id: el.subject_id,
          subject_name: el.element_name || 'Unknown Subject',
          subject_type: 'Compulsory'
        } as any));
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading subjects:', err);
        this.subjects = [];
        this.loading = false;
      }
    });
  }

  onSubjectChange(): void {
    if (this.selectedSubjectId && this.selectedExamSetId) {
      this.loadAssessmentElements();
    }
  }

  getSelectedSubjectName(): string {
    const subject = this.subjects.find(s => s.subject_id === this.selectedSubjectId);
    return subject?.subject_name || '';
  }

  loadAssessmentElements(): void {
    if (!this.selectedExamSetId) return;

    this.loadingElements = true;
    this.marksService.getAssessmentElements(this.selectedExamSetId).subscribe({
      next: (elements) => {
        // Filter to only show elements for selected subject
        this.assessmentElements = elements.filter(el => el.subject_id === this.selectedSubjectId);
        this.loadingElements = false;
      },
      error: (err) => {
        console.error('Error loading assessment elements:', err);
        this.assessmentElements = [];
        this.loadingElements = false;
      }
    });
  }

  async downloadTemplate(): Promise<void> {
    if (!this.selectedExamSetId || !this.selectedSubjectId) {
      alert('Please select an exam set and subject first');
      return;
    }

    try {
      const XLSX = await import('xlsx');
      const headers = ['Student Reg Number', 'Student Name', 'Student LIN (Optional)'];
      const elementHeaders = this.assessmentElements.map(el => `${el.element_name} (Max: ${el.max_score})`);
      headers.push(...elementHeaders);

      const ws = XLSX.utils.aoa_to_sheet([headers]);
      const wb = XLSX.utils.book_new();
      const selectedSubject = this.subjects.find(s => s.subject_id === this.selectedSubjectId);
      const sheetName = selectedSubject?.subject_name || 'Marks Template';
      XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 30)); // Sheet names limited to 31 chars

      XLSX.writeFile(wb, `${sheetName}_marks_template.xlsx`);
    } catch (err) {
      console.error('Error generating template:', err);
      alert('Failed to generate template');
    }
  }

  onFileSelect(event: any): void {
    const file = event.target.files[0];
    if (!file || !this.selectedExamSetId || !this.selectedSubjectId) {
      alert('Please select exam set and subject first');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        this.processUploadData(jsonData);
      } catch (error) {
        console.error('Error reading file:', error);
        alert('Failed to read file');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  processUploadData(data: any[]): void {
    if (!this.selectedExamSetId) return;

    this.marksService.getAssessmentElements(this.selectedExamSetId).subscribe({
      next: (elements) => {
        const entries: BulkMarkEntry[] = [];

        for (const row of data) {
          const regNumber = row['Student Reg Number'];
          const linNumber = row['Student LIN (Optional)'];

          if (!regNumber && !linNumber) continue;

          const marks: { element_id: number; score_obtained: number }[] = [];

          for (const element of elements) {
            const columnPattern = new RegExp(`^${element.element_name}\\s*\\(Max:\\s*\\d+\\)$`, 'i');
            const matchingColumn = Object.keys(row).find(key => columnPattern.test(key));

            if (matchingColumn && row[matchingColumn] !== undefined && row[matchingColumn] !== '') {
              marks.push({
                element_id: element.element_id,
                score_obtained: parseFloat(row[matchingColumn])
              });
            }
          }

          if (marks.length > 0) {
            entries.push({
              student_identifier: linNumber || regNumber,
              identifier_type: linNumber ? 'lin_number' : 'reg_number',
              marks
            });
          }
        }

        this.uploadMarks(entries);
      },
      error: (err) => {
        console.error('Error loading elements:', err);
        alert('Failed to process upload');
      }
    });
  }

  uploadMarks(entries: BulkMarkEntry[]): void {
    if (!this.selectedExamSetId) return;

    this.loading = true;
    this.marksService.bulkUploadMarks(this.selectedExamSetId, this.schoolId, entries).subscribe({
      next: (result) => {
        this.uploadResult = result;
        this.loading = false;
        alert(`Upload complete! ${result.success} students processed successfully. ${result.errors.length} errors.`);
      },
      error: (err) => {
        console.error('Error uploading marks:', err);
        alert('Failed to upload marks: ' + (err.error?.message || 'Unknown error'));
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/marks']);
  }

  goToCreateExamSet(): void {
    this.router.navigate(['/marks/exam-sets']);
  }
}
