import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SubscriptionService } from '../../services/subscription.service';
import { SchoolService, School } from '../../services/school.service';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './subscription.component.html',
  styleUrls: ['./subscription.component.scss']
})
export class SubscriptionComponent implements OnInit {
  selectedSchool$: Observable<School | null>;
  showPurchase = false;
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
    private snackBar: MatSnackBar
  ) {
    this.selectedSchool$ = this.schoolService.selectedSchool$;
  }

  showSuccessMessage() {
    this.snackBar.open(
      '✓ Your subscription order was successful! Call 0773913902 in case of delayed response.', 
      'Close', 
      {
        duration: 10000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['success-snackbar']
      }
    );
  }

  ngOnInit(): void {
    // Optionally, trigger a refresh or selection logic here
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
        case 'Custom': this.form.numberOfSms = 0; this.selectedPrice = 0; break;
        default: this.form.numberOfSms = 0; this.selectedPrice = 0;
      }
      this.showPurchase = true;
    });
  }

  confirmPurchase(): void {
    // send order to backend which will notify via SMS and email
    this.subscriptionService.order({ ...this.form, price: this.selectedPrice }).subscribe({
      next: (res) => {
        console.log('Order sent', res);
        this.showSuccessMessage();
        this.showPurchase = false;
      },
      error: (err) => {
        console.error('Order failed', err);
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