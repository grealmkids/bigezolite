import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SchoolService } from './school.service';

@Injectable({
  providedIn: 'root'
})
export class CommunicationService {
  private apiUrl = `${environment.apiUrl}/communications`;

  private smsCreditBalance = new BehaviorSubject<number>(0);
  smsCreditBalance$ = this.smsCreditBalance.asObservable();

  constructor(private http: HttpClient, private schoolService: SchoolService) { 
    this.fetchSmsCreditBalance();
  }

  fetchSmsCreditBalance(): void {
    this.http.get<number>(`${this.apiUrl}/credits`).subscribe(balance => {
      this.smsCreditBalance.next(balance);
    });
  }

  sendBulkSms(recipientFilter: string, message: string): Observable<any> {
    const schoolId = this.schoolService.getSelectedSchoolId();
    const q = schoolId ? `?schoolId=${schoolId}` : '';
    const url = `${this.apiUrl}/bulk-sms${q}`;
    const body = { recipientFilter, message };
    console.log('[HTTP][POST]', url, body);
    return this.http.post(url, body);
  }

  sendSingleSms(studentId: number, message: string): Observable<any> {
    const schoolId = this.schoolService.getSelectedSchoolId();
    const q = schoolId ? `?schoolId=${schoolId}` : '';
    return this.http.post(`${this.apiUrl}/single-sms${q}`, { studentId, message });
  }

  setSmsCredentials(username: string, password: string, provider?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/credentials`, { username, password, provider });
  }

  getSmsCredentials(): Observable<{ username: string; password: string; provider?: string } | null> {
    return this.http.get<{ username: string; password: string; provider?: string }>(`${this.apiUrl}/credentials`);
  }

  sendFeesReminder(studentId: number): Observable<any> {
    const schoolId = this.schoolService.getSelectedSchoolId();
    const q = schoolId ? `?schoolId=${schoolId}` : '';
    return this.http.post(`${this.apiUrl}/fees-reminder/${studentId}${q}`, {});
  }

  previewBulkFeesReminders(
    thresholdAmount: number = 1000,
    classFilter?: string,
    statusFilter?: string,
    customDeadline?: string,
    year?: string | number,
    term?: string | number,
    feesStatus?: string,
    messageType: 'detailed' | 'sent_home' | 'custom' | 'generic' = 'detailed',
    messageTemplate?: string
  ): Observable<any> {
    const body: any = { thresholdAmount, messageType };
    if (classFilter) body.classFilter = classFilter;
    if (statusFilter) body.statusFilter = statusFilter;
    if (customDeadline) body.customDeadline = customDeadline;
    if (year) body.year = year;
    if (term) body.term = term;
    if (feesStatus) body.feesStatus = feesStatus;
    if (messageTemplate != null) body.messageTemplate = messageTemplate;
    const url = `${this.apiUrl}/bulk-fees-reminders/preview`;
    console.log('[HTTP][POST]', url, body);
    return this.http.post(url, body);
  }

  sendBulkFeesReminders(
    thresholdAmount: number = 1000,
    classFilter?: string,
    statusFilter?: string,
    customDeadline?: string,
    year?: string | number,
    term?: string | number,
    feesStatus?: string,
    messageType: 'detailed' | 'sent_home' | 'custom' | 'generic' = 'detailed',
    messageTemplate?: string
  ): Observable<any> {
    const body: any = { thresholdAmount, messageType };
    if (classFilter) body.classFilter = classFilter;
    if (statusFilter) body.statusFilter = statusFilter;
    if (customDeadline) body.customDeadline = customDeadline;
    if (year) body.year = year;
    if (term) body.term = term;
    if (feesStatus) body.feesStatus = feesStatus;
    if (messageTemplate != null) body.messageTemplate = messageTemplate;
    const url = `${this.apiUrl}/bulk-fees-reminders`;
    console.log('[HTTP][POST]', url, body);
    return this.http.post(url, body);
  }
}
