
import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'app-order-confirmation-dialog',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatButtonModule],
    templateUrl: './order-confirmation-dialog.component.html',
    styleUrls: ['./order-confirmation-dialog.component.scss']
})
export class OrderConfirmationDialogComponent {
    constructor(
        public dialogRef: MatDialogRef<OrderConfirmationDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: {
            packageType: string;
            smsCount: number;
            price: number;
        }
    ) { }

    onCancel(): void {
        this.dialogRef.close(false);
    }

    onConfirm(): void {
        this.dialogRef.close(true);
    }

    formatNumber(val: number): string {
        return new Intl.NumberFormat('en-UG').format(val);
    }
}
