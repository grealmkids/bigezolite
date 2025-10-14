import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FeeRecord {
    fee_record_id: number;
    student_id: number;
    term: number;
    year: number;
    total_fees_due: number;
    amount_paid: number;
    balance_due: number;
    due_date: string; // Comes as a string from JSON
    rsvp_number: string;
}

export interface NewFeeRecord {
    term: number;
    year: number;
    total_fees_due: number;
    due_date: string;
    rsvp_number: string;
}

@Injectable({
  providedIn: 'root'
})
export class FeesService {
  private apiUrl = 'http://localhost:3000/api/v1';

  constructor(private http: HttpClient) { }

  getFeeRecords(studentId: number): Observable<FeeRecord[]> {
    return this.http.get<FeeRecord[]>(`${this.apiUrl}/students/${studentId}/fees`);
  }

  createFeeRecord(studentId: number, feeData: NewFeeRecord): Observable<FeeRecord> {
    return this.http.post<FeeRecord>(`${this.apiUrl}/students/${studentId}/fees`, feeData);
  }

  updateFeeRecord(feeRecordId: number, amount_paid: number): Observable<FeeRecord> {
    return this.http.put<FeeRecord>(`${this.apiUrl}/fees/${feeRecordId}`, { amount_paid });
  }
}