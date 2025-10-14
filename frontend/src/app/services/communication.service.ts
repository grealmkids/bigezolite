import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CommunicationService {
  private apiUrl = `${environment.apiUrl}/communications`;

  private smsCreditBalance = new BehaviorSubject<number>(0);
  smsCreditBalance$ = this.smsCreditBalance.asObservable();

  constructor(private http: HttpClient) { 
    this.fetchSmsCreditBalance();
  }

  fetchSmsCreditBalance(): void {
    this.http.get<number>(`${this.apiUrl}/credits`).subscribe(balance => {
      this.smsCreditBalance.next(balance);
    });
  }

  sendBulkSms(recipientFilter: string, message: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/bulk-sms`, { recipientFilter, message });
  }

  sendSingleSms(studentId: number, message: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/single-sms`, { studentId, message });
  }
}