
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PesapalOrderResponse {
    order_tracking_id: string;
    redirect_url: string;
    error?: any;
    status: string;
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private apiUrl = `${environment.apiUrl}/subscription`;

  constructor(private http: HttpClient) { }

  initiatePayment(packageType: string): Observable<PesapalOrderResponse> {
    return this.http.post<PesapalOrderResponse>(`${this.apiUrl}/initiate-payment`, { packageType });
  }

  getPaymentStatus(orderTrackingId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/payment-status/${orderTrackingId}`);
  }

  order(orderPayload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/order`, orderPayload);
  }
}
