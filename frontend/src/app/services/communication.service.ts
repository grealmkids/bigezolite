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

  setSmsCredentials(username: string, password: string, provider?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/credentials`, { username, password, provider });
  }

  getSmsCredentials(): Observable<{ username: string; password: string; provider?: string } | null> {
    return this.http.get<{ username: string; password: string; provider?: string }>(`${this.apiUrl}/credentials`);
  }

  sendFeesReminder(studentId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/fees-reminder/${studentId}`, {});
  }

  previewBulkFeesReminders(
    thresholdAmount: number = 1000,
    classFilter?: string,
    statusFilter?: string,
    customDeadline?: string
  ): Observable<any> {
    const body: any = { thresholdAmount };
    if (classFilter) body.classFilter = classFilter;
    if (statusFilter) body.statusFilter = statusFilter;
    if (customDeadline) body.customDeadline = customDeadline;
    return this.http.post(`${this.apiUrl}/bulk-fees-reminders/preview`, body);
  }

  sendBulkFeesReminders(
    thresholdAmount: number = 1000,
    classFilter?: string,
    statusFilter?: string,
    customDeadline?: string
  ): Observable<any> {
    const body: any = { thresholdAmount };
    if (classFilter) body.classFilter = classFilter;
    if (statusFilter) body.statusFilter = statusFilter;
    if (customDeadline) body.customDeadline = customDeadline;
    return this.http.post(`${this.apiUrl}/bulk-fees-reminders`, body);
  }
}
