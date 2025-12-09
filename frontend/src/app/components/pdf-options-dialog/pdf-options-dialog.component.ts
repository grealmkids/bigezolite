import { Component } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-pdf-options-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, FormsModule, MatIconModule],
  templateUrl: './pdf-options-dialog.component.html',
  styles: [`
    .section-label { font-size: 0.9rem; font-weight: 600; color: #555; margin: 0 0 0.5rem 0; }
    .compact-options { display: flex; gap: 1rem; }
    .compact-btn {
      flex: 1; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; 
      background: white; cursor: pointer; font-weight: 500; color: #444;
      transition: all 0.2s;
    }
    .compact-btn.selected { border-color: #2962ff; background: #e3f2fd; color: #2962ff; font-weight: 600; }
    
    .color-grid { display: flex; flex-wrap: wrap; gap: 1rem; }
    .color-item { cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .color-circle {
      width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s;
    }
    .color-item:hover .color-circle { transform: scale(1.1); }
    .check-icon { font-size: 18px; color: white; width: 18px; height: 18px; text-shadow: 0 1px 2px rgba(0,0,0,0.3); }
    .color-name { font-size: 0.75rem; color: #666; }
  `]
})
export class PdfOptionsDialogComponent {
  selectedOption: 'with-photos' | 'no-photos' = 'no-photos';
  selectedColor: string = 'White';
  customColor: string = '#ffffff';

  selectedTextColor: string = 'Black';
  customTextColor: string = '#000000';

  availableColors: string[] = ['White', 'Black', 'Blue', 'Red', 'Green', 'Yellow', 'Brown', 'Purple', 'Custom'];

  // Map friendly names to hex for preview/logic where needed, though we pass the name or hex code
  colorMap: Record<string, string> = {
    'White': '#FFFFFF',
    'Black': '#000000',
    'Blue': '#1976D2',
    'Red': '#D32F2F',
    'Green': '#388E3C',
    'Yellow': '#FBC02D',
    'Brown': '#795548',
    'Purple': '#7B1FA2',
    'Custom': 'transparent'
  };

  constructor(public dialogRef: MatDialogRef<PdfOptionsDialogComponent>) { }

  selectOption(option: 'with-photos' | 'no-photos') {
    this.selectedOption = option;
  }

  selectColor(type: 'bg' | 'text', color: string) {
    if (type === 'bg') {
      this.selectedColor = color;
      // Auto-set text color for better UX if not Custom
      if (color !== 'Custom' && color !== 'White') this.selectedTextColor = 'White';
      if (color === 'White') this.selectedTextColor = 'Black';
    } else {
      this.selectedTextColor = color;
    }
  }

  onDownload() {
    const finalColor = this.selectedColor === 'Custom' ? this.customColor : this.colorMap[this.selectedColor];
    const finalTextColor = this.selectedTextColor === 'Custom' ? this.customTextColor : this.colorMap[this.selectedTextColor];

    this.dialogRef.close({
      includePhotos: this.selectedOption === 'with-photos',
      themeColor: finalColor,
      themeTextColor: finalTextColor
    });
  }

  onCancel() {
    this.dialogRef.close(undefined);
  }
}
