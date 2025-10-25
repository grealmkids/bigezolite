import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FeeToTrack {
  fee_id: number;
  school_id: number;
  name: string;
  description?: string;
  total_due: number;
  term: number;
  year: number;
  class_name: string | null; // null means All
  due_date: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({ providedIn: 'root' })
export class FeesToTrackService {
  private apiUrl = 'http://localhost:3000/api/v1/fees-to-track';
  constructor(private http: HttpClient) {}

  list(schoolId: number): Observable<FeeToTrack[]> {
    const params = new HttpParams().set('schoolId', String(schoolId));
    return this.http.get<FeeToTrack[]>(this.apiUrl, { params });
    }

  create(schoolId: number, payload: { name: string; description?: string; total_due: number; term: number; year: number; class_name: string | null; due_date: string }): Observable<FeeToTrack> {
    const params = new HttpParams().set('schoolId', String(schoolId));
    return this.http.post<FeeToTrack>(this.apiUrl, payload, { params });
  }

  update(fee_id: number, payload: Partial<Omit<FeeToTrack, 'fee_id'|'school_id'>>): Observable<FeeToTrack> {
    return this.http.put<FeeToTrack>(`${this.apiUrl}/${fee_id}`, payload);
  }

  getById(fee_id: number): Observable<FeeToTrack> {
    return this.http.get<FeeToTrack>(`${this.apiUrl}/${fee_id}`);
  }

  delete(fee_id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${fee_id}`);
  }
}
