import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Student } from '../../services/student.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommunicationService } from '../../services/communication.service';

@Component({
  selector: 'app-sms-student-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sms-student-modal.component.html',
  styleUrls: ['./sms-student-modal.component.scss']
})
export class SmsStudentModalComponent {
  private _student: Student | null = null;
  @Input() set student(val: Student | null) {
    this._student = val;
    this.forceUpdateView();
  }
  get student(): Student | null {
    return this._student;
  }

  forceUpdateView() {
    // This method is a placeholder for any future logic to force update view if needed
    // For now, it just triggers change detection by updating a dummy property if needed
  }
  @Output() close = new EventEmitter<void>();

  message = '';
  characterCount = 0;
  smsCreditsConsumed = 1;
  isSending = false;
  sendResult: { success: boolean; message: string } | null = null;
  // Toast state (transient notification)
  toastVisible = false;
  toastMessage = '';
  toastSuccess = false;

  constructor(private communicationService: CommunicationService) { }

  onMessageChange(message: string): void {
    this.message = message;
    this.characterCount = message.length;
    this.smsCreditsConsumed = Math.ceil(message.length / 160);
  }

  sendSms(): void {
    if (this.student && this.message) {
      this.isSending = true;
      this.sendResult = null;
      this.communicationService.sendSingleSms(this.student.student_id, this.message).subscribe({
        next: () => {
          this.isSending = false;
          this.sendResult = { success: true, message: 'SMS sent successfully' };
          this.showToast('SMS sent successfully', true);
          // close modal after a short delay
          setTimeout(() => this.close.emit(), 900);
        },
        error: (err) => {
          this.isSending = false;
          const msg = err?.error?.message || err?.message || 'Failed to send SMS';
          this.sendResult = { success: false, message: msg };
          // Prefer provider details if present
          const providerDetail = err?.error?.details || null;
          this.showToast(providerDetail ? `${msg}: ${providerDetail}` : msg, false);
        }
      });
    }
  }

  private showToast(message: string, success: boolean) {
    this.toastMessage = message;
    this.toastSuccess = success;
    this.toastVisible = true;
    // auto-hide after 3s
    setTimeout(() => {
      this.toastVisible = false;
    }, 3000);
  }
}