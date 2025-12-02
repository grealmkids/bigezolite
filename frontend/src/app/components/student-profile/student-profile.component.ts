import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Student } from '../../services/student.service';

@Component({
  selector: 'app-student-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-profile.component.html',
  styleUrls: ['./student-profile.component.scss']
})
export class StudentProfileComponent {
  @Input() student: Student | null = null;
  @Output() close = new EventEmitter<void>();

  get photoUrl(): string | null {
    return (this.student as any)?.student_photo_url || null;
  }

  onClose(): void {
    this.close.emit();
  }
}
