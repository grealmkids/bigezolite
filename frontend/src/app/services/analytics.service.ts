import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AnalyticsData {
  totalStudents: number;
  activeStudents: number;
  inactiveStudents: number;
  alumniStudents: number;
  expelledStudents: number;
  suspendedStudents: number;
  sickStudents: number;
  activeBoys: number;
  activeGirls: number;
  smsBalance: number;
  smsCount: number;
  // New aggregates from server
  totalPaidAmount?: number;
  totalDefaulterBalance?: number;
  paidStudentsCount?: number;
  defaulterStudentsCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private apiUrl = `${environment.apiUrl}/analytics`;

  constructor(private http: HttpClient) {}

  getAnalytics(schoolId?: number, year?: number | string, term?: number | string, refresh?: boolean): Observable<AnalyticsData> {
    const params: any = {};
    if (schoolId) params.schoolId = String(schoolId);
    if (year !== undefined && year !== null && year !== '') params.year = String(year);
    if (term !== undefined && term !== null && term !== '') params.term = String(term);
    if (refresh) params.refresh = 'true';
    const options = Object.keys(params).length ? { params } : {};
    return this.http.get<AnalyticsData>(this.apiUrl, options);
  }
}
