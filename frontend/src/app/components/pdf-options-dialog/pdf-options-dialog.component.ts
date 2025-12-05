import { Component } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pdf-options-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  templateUrl: './pdf-options-dialog.component.html',
  styles: [`
    .options-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem 0;
    }
    .option-btn {
      text-align: left;
      padding: 1.5rem;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      background: white;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 1rem;
      cursor: pointer;
      width: 100%;
    }
    .option-btn:hover {
      border-color: #2962ff;
      background-color: #f5f9ff;
    }
    .option-btn.selected {
      border-color: #2962ff;
      background-color: #e3f2fd;
    }
    .option-content {
      display: flex;
      flex-direction: column;
    }
    .option-title {
      font-weight: 600;
      font-size: 1.1rem;
      color: #333;
    }
    .option-desc {
      font-size: 0.9rem;
      color: #666;
      margin-top: 0.25rem;
    }
    .download-btn {
      width: 100%;
      padding: 0.75rem;
      font-size: 1.1rem;
      margin-top: 1rem;
    }
  `]
})
export class PdfOptionsDialogComponent {
  selectedOption: 'with-photos' | 'no-photos' = 'no-photos';

  constructor(public dialogRef: MatDialogRef<PdfOptionsDialogComponent>) { }

  selectOption(option: 'with-photos' | 'no-photos') {
    this.selectedOption = option;
  }

  onDownload() {
    this.dialogRef.close(this.selectedOption === 'with-photos');
  }

  onCancel() {
    this.dialogRef.close(undefined);
  }
}
