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
    // Prefer server preview endpoint which validates per-school credentials and
    // returns provider-backed balance as part of its response. This works for
    // schools that may be marked 'Dormant' where the /credits endpoint can return 403.
    try {
      this.previewBulkSms('All Students').subscribe({
        next: (resp: any) => {
          if (resp && typeof resp.currentBalance !== 'undefined') {
            this.smsCreditBalance.next(Number(resp.currentBalance));
            return;
          }
          // Fallback to credits endpoint if preview response is missing balance
          this.http.get<number>(`${this.apiUrl}/credits`).subscribe(balance => this.smsCreditBalance.next(balance));
        },
        error: () => {
          // If preview fails (permissions etc.), fall back to credits endpoint
          this.http.get<number>(`${this.apiUrl}/credits`).subscribe({
            next: balance => this.smsCreditBalance.next(balance),
            error: (err) => {
              console.error('[CommunicationService][fetchSmsCreditBalance] both preview and credits endpoints failed', err);
            }
          });
        }
      });
    } catch (e) {
      // Ensure any unexpected errors fall back to the credits endpoint
      this.http.get<number>(`${this.apiUrl}/credits`).subscribe({
        next: balance => this.smsCreditBalance.next(balance),
        error: (err) => console.error('[CommunicationService][fetchSmsCreditBalance] credits endpoint failed', err)
      });
    }
  }

  sendBulkSms(recipientFilter: string, message: string): Observable<any> {
    const schoolId = this.schoolService.getSelectedSchoolId();
    const qs = schoolId ? `?schoolId=${schoolId}` : '';
    const url = `${this.apiUrl}/bulk-sms${qs}`;
    const body = { recipientFilter, message };
    console.log('[HTTP][POST]', url, body);
    return this.http.post(url, body);
  }

  previewBulkSms(recipientFilter: string): Observable<any> {
    const schoolId = this.schoolService.getSelectedSchoolId();
    const qs = schoolId ? `?schoolId=${schoolId}` : '';
    const url = `${this.apiUrl}/bulk-sms/preview${qs}`;
    const body = { recipientFilter };
    console.log('[HTTP][POST]', url, body);
    return this.http.post<any>(url, body);
  }

  /**
   * Preview bulk fees reminders. Payload mirrors backend preview endpoint.
   */
  previewBulkFeesReminders(
    thresholdAmount: number,
    classFilter?: string,
    statusFilter?: string,
    customDeadline?: string,
    year?: string,
    term?: string,
    feesStatus?: string,
    messageType: string = 'detailed',
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

    const schoolId = this.schoolService.getSelectedSchoolId();
    const qs = schoolId ? `?schoolId=${schoolId}` : '';
    const url = `${this.apiUrl}/bulk-fees-reminders/preview${qs}`;
    console.log('[HTTP][POST]', url, body);
    return this.http.post<any>(url, body);
  }

  /**
   * Send bulk fees reminders using the backend endpoint.
   */
  sendBulkFeesReminders(
    thresholdAmount: number,
    classFilter?: string,
    statusFilter?: string,
    customDeadline?: string,
    year?: string,
    term?: string,
    feesStatus?: string,
    messageType: string = 'detailed',
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

    const schoolId = this.schoolService.getSelectedSchoolId();
    const qs = schoolId ? `?schoolId=${schoolId}` : '';
    const url = `${this.apiUrl}/bulk-fees-reminders${qs}`;
    console.log('[HTTP][POST]', url, body);
    return this.http.post<any>(url, body);
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
}