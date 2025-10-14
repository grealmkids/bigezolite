import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscription.component.html',
  styleUrl: './subscription.component.scss'
})
export class SubscriptionComponent {

  constructor(private subscriptionService: SubscriptionService) { }

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