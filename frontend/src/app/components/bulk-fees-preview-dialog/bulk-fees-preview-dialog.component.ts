import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-bulk-fees-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="title-icon">campaign</mat-icon>
      Campaign Preview
    </h2>
    <mat-dialog-content>
      <div class="analytics-grid">
        <div class="analytics-card">
          <div class="card-icon">
            <mat-icon>people</mat-icon>
          </div>
          <div class="card-content">
            <div class="label">Recipients</div>
            <div class="value">{{ data.recipientCount }}</div>
          </div>
        </div>
        <div class="analytics-card">
          <div class="card-icon">
            <mat-icon>account_balance_wallet</mat-icon>
          </div>
          <div class="card-content">
            <div class="label">Airtime Balance</div>
            <div class="value">UGX {{ data.creditBalance | number:'1.0-0' }}</div>
          </div>
        </div>
        <div class="analytics-card">
          <div class="card-icon">
            <mat-icon>monetization_on</mat-icon>
          </div>
          <div class="card-content">
            <div class="label">Est. Cost</div>
            <div class="value">UGX {{ data.estimatedCost | number:'1.0-0' }}</div>
          </div>
        </div>
        <div class="analytics-card">
          <div class="card-icon">
            <mat-icon>message</mat-icon>
          </div>
          <div class="card-content">
            <div class="label">Message Size</div>
            <div class="value">{{ data.messageLength }} chars ({{ data.smsUnits }} SMS)</div>
          </div>
        </div>
      </div>

      <div class="section-title">
        <mat-icon>text_snippet</mat-icon> Sample Message
      </div>
      <div class="sample-message">
        {{ data.sampleMessage }}
      </div>

      <div class="section-title">
        <mat-icon>list</mat-icon> Recipient List ({{ data.recipientCount }})
      </div>
      <div class="recipients-list">
        <div class="recipient-item header">
          <span>Name</span>
          <span>Phone</span>
          <span>Balance</span>
        </div>
        <div class="recipient-item" *ngFor="let recipient of data.recipients.slice(0, 10)">
          <span>{{ recipient.studentName }}</span>
          <span>{{ recipient.phoneNumber }}</span>
          <span>UGX {{ recipient.balance | number:'1.0-0' }}</span>
        </div>
        <div class="recipient-item note" *ngIf="data.recipients.length > 10">
          <span>...and {{ data.recipients.length - 10 }} more</span>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSend()" [disabled]="isSending">
        <mat-icon>send</mat-icon>
        {{ isSending ? 'Sending...' : 'Send Reminders' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .title-icon { vertical-align: middle; margin-right: 8px; color: #2962ff; }
    .analytics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .analytics-card {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 1rem;
      border: 1px solid #e0e0e0;
    }
    .card-icon mat-icon { color: #666; font-size: 24px; width: 24px; height: 24px; }
    .card-content { display: flex; flex-direction: column; }
    .label { font-size: 0.75rem; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .value { font-size: 1.1rem; font-weight: 600; color: #333; }
    
    .section-title {
      font-weight: 600;
      color: #333;
      margin: 1.5rem 0 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.95rem;
    }
    .section-title mat-icon { font-size: 18px; width: 18px; height: 18px; color: #666; }

    .sample-message {
      background: #e3f2fd;
      padding: 1rem;
      border-radius: 8px;
      color: #1565c0;
      font-family: monospace;
      white-space: pre-wrap;
      border-left: 4px solid #2196f3;
    }

    .recipients-list {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }
    .recipient-item {
      display: grid;
      grid-template-columns: 2fr 1.5fr 1.5fr;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #f0f0f0;
      font-size: 0.9rem;
    }
    .recipient-item:last-child { border-bottom: none; }
    .recipient-item.header {
      background: #f5f5f5;
      font-weight: 600;
      color: #666;
    }
    .recipient-item.note {
      justify-content: center;
      color: #888;
      font-style: italic;
      display: flex;
    }
  `]
})
export class BulkFeesPreviewDialogComponent {
  isSending = false;

  constructor(
    public dialogRef: MatDialogRef<BulkFeesPreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) { }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onSend(): void {
    this.isSending = true;
    this.dialogRef.close(true);
  }
}
