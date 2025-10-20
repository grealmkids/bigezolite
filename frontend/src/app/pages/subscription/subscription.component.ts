import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubscriptionService } from '../../services/subscription.service';
import { SchoolService, School } from '../../services/school.service';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription.component.html',
  styleUrl: './subscription.component.scss'
})
export class SubscriptionComponent implements OnInit {
  selectedSchool$: Observable<School | null>;
  showPurchase = false;
  form: {
    schoolName: string;
    contactPhone: string;
    selectedPackage: string;
    numberOfSms: number;
  } = { schoolName: '', contactPhone: '', selectedPackage: '', numberOfSms: 0 };

  constructor(
    private subscriptionService: SubscriptionService,
    private schoolService: SchoolService
  ) {
    this.selectedSchool$ = this.schoolService.selectedSchool$;
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
        case 'Pay-As-You-Go 1': this.form.numberOfSms = 100; break;
        case 'Pay-As-You-Go 2': this.form.numberOfSms = 410; break;
        case 'Premium 1': this.form.numberOfSms = 10500; break;
        case 'Custom': this.form.numberOfSms = 0; break;
        default: this.form.numberOfSms = 0;
      }
      this.showPurchase = true;
    });
  }

  confirmPurchase(): void {
    // For now, do not call Pesapal — just log and close. Real payment remains in subscriptionService.
    console.log('Order created', this.form);
    this.showPurchase = false;
    // Optionally call subscriptionService.initiatePayment when integrating Pesapal
  }

  cancelPurchase(): void {
    this.showPurchase = false;
  }
}