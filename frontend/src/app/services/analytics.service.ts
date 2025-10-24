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
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private apiUrl = `${environment.apiUrl}/analytics`;

  constructor(private http: HttpClient) {}

  getAnalytics(schoolId?: number): Observable<AnalyticsData> {
    const options = schoolId 
      ? { params: { schoolId: schoolId.toString() } } 
      : {};
    return this.http.get<AnalyticsData>(this.apiUrl, options);
  }
}
