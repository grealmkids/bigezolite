import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SubscriptionService } from '../../services/subscription.service';
import { SchoolService, School } from '../../services/school.service';
import { CommunicationService } from '../../services/communication.service';
import { LoadingService } from '../../services/loading.service';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { OrderConfirmationDialogComponent } from '../../components/order-confirmation-dialog/order-confirmation-dialog.component';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule, MatDialogModule],
  templateUrl: './subscription.component.html',
  styleUrls: ['./subscription.component.scss']
})
export class SubscriptionComponent implements OnInit {
  selectedSchool$: Observable<School | null>;
  showPurchase = false;
  // Show the custom amount modal when user selects Custom package
  showCustomModal = false;
  customAmount = 0;
  costPerSms = 50; // UGX per SMS (default; will try to fetch from backend)
  selectedPrice = 0;
  form: {
    schoolName: string;
    contactPhone: string;
    selectedPackage: string;
    numberOfSms: number;
  } = { schoolName: '', contactPhone: '', selectedPackage: '', numberOfSms: 0 };

  constructor(
    private subscriptionService: SubscriptionService,
    private schoolService: SchoolService,
    private snackBar: MatSnackBar,
    private communicationService: CommunicationService,
    private loadingService: LoadingService,
    private dialog: MatDialog
  ) {
    this.selectedSchool$ = this.schoolService.selectedSchool$;
  }

  showSuccessMessage() {
    this.snackBar.open(
      '✓ Your subscription order was successful! Call 0773913902 in case of delayed response.',
      'Close',
      {
        duration: 0, // Manual close
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['success-snackbar']
      }
    );
  }

  ngOnInit(): void {
    // Try to fetch the current cost-per-sms from the backend (if available).
    // We call a lightweight preview endpoint that returns costPerSms as part of its response.
    try {
      this.communicationService.previewBulkSms('All Students').subscribe({
        next: (res: any) => {
          if (res && typeof res.costPerSms === 'number') {
            this.costPerSms = Number(res.costPerSms) || this.costPerSms;
          }
        },
        error: () => {
          // ignore — keep default costPerSms
        }
      });
    } catch (e) {
      // ignore errors and keep default value
    }
  }

  purchasePackage(packageType: string): void {
    // Show purchase form prefilled with selected school and package details
    this.selectedSchool$.pipe(take(1)).subscribe(s => {
      if (!s) return;
      this.form.schoolName = s.school_name || '';
      this.form.contactPhone = s.admin_phone || '';
      this.form.selectedPackage = packageType;
      // preset numberOfSms based on packageType (simple mapping)
      switch (packageType) {
        case 'Pay-As-You-Go 1': this.form.numberOfSms = 100; this.selectedPrice = 5000; break;
        case 'Pay-As-You-Go 2': this.form.numberOfSms = 410; this.selectedPrice = 20000; break;
        case 'Premium 1': this.form.numberOfSms = 10500; this.selectedPrice = 500000; break;
        case 'Custom':
          // Open a small modal to collect custom amount instead of immediate purchase form
          this.form.numberOfSms = 0; this.selectedPrice = 0;
          // Defer showing main purchase form — show custom modal first
          this.showCustomModal = true;
          return;
        default: this.form.numberOfSms = 0; this.selectedPrice = 0;
      }
      this.showPurchase = true;
    });
  }

  // Called when user confirms amount in custom modal
  confirmCustomAmount(): void {
    const amount = Number(this.customAmount) || 0;
    // compute sms count (floor of amount / costPerSms)
    const smsCount = Math.max(0, Math.floor(amount / this.costPerSms));
    this.form.selectedPackage = 'Custom';
    this.form.numberOfSms = smsCount;
    this.selectedPrice = amount;
    this.showCustomModal = false;
    // show the existing purchase form so user can confirm contact details
    this.showPurchase = true;
  }

  cancelCustom(): void {
    this.showCustomModal = false;
  }

  get computedSmsCount(): number {
    const amount = Number(this.customAmount) || 0;
    return Math.max(0, Math.floor(amount / this.costPerSms));
  }

  confirmPurchase(): void {
    // Confirm via dialog first
    const dialogRef = this.dialog.open(OrderConfirmationDialogComponent, {
      width: '450px',
      disableClose: true,
      data: {
        packageType: this.form.selectedPackage,
        smsCount: this.form.numberOfSms,
        price: this.selectedPrice
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.submitOrder();
      }
    });
  }

  private submitOrder(): void {
    // send order to backend which will notify via SMS and email
    // show global loading indicator (if not already shown by interceptor)
    try { this.loadingService.show(); } catch (e) { }
    this.subscriptionService.order({ ...this.form, price: this.selectedPrice }).subscribe({
      next: (res) => {
        console.log('Order sent', res);
        // stop any loading spinner and show success
        try { this.loadingService.hide(); } catch (e) { }
        this.showSuccessMessage();
        this.showPurchase = false;
      },
      error: (err) => {
        console.error('Order failed', err);
        try { this.loadingService.hide(); } catch (e) { }
        this.snackBar.open('Failed to place order. Please try again.', 'Close', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  cancelPurchase(): void {
    this.showPurchase = false;
  }
}
