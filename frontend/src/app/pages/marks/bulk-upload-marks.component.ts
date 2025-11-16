import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MarksService, ExamSet, BulkMarkEntry } from '../../services/marks.service';

@Component({
  selector: 'app-bulk-upload-marks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bulk-upload-marks.component.html',
  styleUrls: ['./bulk-upload-marks.component.scss']
})
export class BulkUploadMarksComponent implements OnInit {
  schoolId: number = 0;
  examSets: ExamSet[] = [];
  selectedExamSet: number | null = null;
  loading = false;
  uploadResult: { success: number; errors: any[] } | null = null;

  constructor(private marksService: MarksService, private router: Router) {}

  ngOnInit(): void {
    const storedSchoolId = localStorage.getItem('currentSchoolId');
    if (storedSchoolId) {
      this.schoolId = parseInt(storedSchoolId);
      this.loadExamSets();
    }
  }

  loadExamSets(): void {
    this.marksService.getExamSets(this.schoolId).subscribe({
      next: (data) => {
        this.examSets = data;
      },
      error: (err) => console.error('Error loading exam sets:', err)
    });
  }

  async downloadTemplate(): Promise<void> {
    if (!this.selectedExamSet) {
      alert('Please select an exam set first');
      return;
    }

    this.marksService.getAssessmentElements(this.selectedExamSet).subscribe({
      next: async (elements) => {
        try {
          const XLSX = await import('xlsx');
          const headers = ['Student Reg Number', 'Student LIN (Optional)'];
          const elementHeaders = elements.map(el => `${el.element_name} (Max: ${el.max_score})`);
          headers.push(...elementHeaders);

          const ws = XLSX.utils.aoa_to_sheet([headers]);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Marks Template');

          XLSX.writeFile(wb, 'marks_upload_template.xlsx');
        } catch (err) {
          console.error('Error generating template (dynamic import):', err);
          alert('Failed to generate template');
        }
      },
      error: (err) => {
        console.error('Error generating template:', err);
        alert('Failed to generate template');
      }
    });
  }

  onFileSelect(event: any): void {
    const file = event.target.files[0];
    if (!file || !this.selectedExamSet) {
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
    if (!this.selectedExamSet) return;

    this.marksService.getAssessmentElements(this.selectedExamSet).subscribe({
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
    if (!this.selectedExamSet) return;

    this.loading = true;
    this.marksService.bulkUploadMarks(this.selectedExamSet, this.schoolId, entries).subscribe({
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
}
