import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubscriptionService } from '../../services/subscription.service';
import { SchoolService, School } from '../../services/school.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscription.component.html',
  styleUrl: './subscription.component.scss'
})
export class SubscriptionComponent implements OnInit {
  selectedSchool$: Observable<School | null>;

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
    this.subscriptionService.initiatePayment(packageType).subscribe(response => {
      if (response && response.redirect_url) {
        // Redirect the user to the Pesapal payment page
        window.location.href = response.redirect_url;
      } else {
        // Handle error
        console.error('Failed to initiate payment');
      }
    });
  }
}