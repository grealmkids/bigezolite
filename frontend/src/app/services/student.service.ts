import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';

export interface Student {
  student_id: number;
  school_id?: number; // School this student belongs to
  reg_number: string;
  student_name: string;
  class_name: string;
  student_status: 'Active' | 'Inactive' | 'Expelled' | 'Alumni' | 'Suspended' | 'Sick';
  fees_status: 'Paid' | 'Pending' | 'Defaulter';
  parent_phone_sms: string;
}

export interface StudentData {
    student_name: string;
    class_name: string;
    year_enrolled: number;
    student_status: 'Active' | 'Inactive' | 'Expelled' | 'Alumni' | 'Suspended' | 'Sick';
    parent_primary_name: string;
    parent_phone_sms: string;
    parent_name_mother?: string;
    parent_name_father?: string;
    residence_district: string;
}

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  getStudentById(studentId: number, schoolId?: number): Observable<Student> {
    let params = new HttpParams();
    if (schoolId) {
      params = params.append('schoolId', schoolId.toString());
    }
    return this.http.get<Student>(`${this.apiUrl}/${studentId}`, { params });
  }
  private apiUrl = 'http://localhost:3000/api/v1/students';

  constructor(private http: HttpClient) { }

  getStudents(schoolId: number, searchTerm?: string, classTerm?: string, statusTerm?: string, feesStatusTerm?: string, yearTerm?: string, term?: string, page: number = 0, pageSize: number = 10, sort: string = 'student_name', order: string = 'ASC'): Observable<{ items: Student[]; total: number }> {
    let params = new HttpParams()
      .append('schoolId', schoolId.toString())
      .append('page', page.toString())
      .append('limit', pageSize.toString())
      .append('sort', sort)
      .append('order', order);
    
    if (searchTerm) {
      params = params.append('search', searchTerm);
    }
    if (classTerm) {
      params = params.append('class', classTerm);
    }
    if (statusTerm) {
      params = params.append('status', statusTerm);
    }
    if (feesStatusTerm) {
      params = params.append('feesStatus', feesStatusTerm);
    }
    if (yearTerm) {
      params = params.append('year', yearTerm);
    }
    if (term) {
      params = params.append('term', term);
    }
  const url = this.apiUrl;
    console.log('[StudentService] GET', url, 'params:', params.toString());
    // Backend may return either an array of students or an object { items, total }
  return this.http.get<any>(url, { params, headers: { 'X-Skip-Global-Loading': 'true' } as any }).pipe(
      tap((resp) => {
        console.log('[StudentService] response payload:', resp);
      }),
      map((resp) => {
        if (Array.isArray(resp)) {
          return { items: resp as Student[], total: (resp as Student[]).length };
        }
        if (resp && Array.isArray(resp.items)) {
          return { items: resp.items as Student[], total: resp.total ?? resp.items.length };
        }
        // fallback: empty
        return { items: [], total: 0 };
      }),
      catchError(err => {
        console.error('[StudentService] HTTP error while fetching students', err?.status, err?.message, err);
        if (err?.status === 403) {
          console.warn('[StudentService] 403 Forbidden received. Check auth token and backend permissions.');
        }
        return throwError(() => err);
      })
    );
  }

  createStudent(studentData: StudentData, schoolId?: number): Observable<Student> {
    let params = new HttpParams();
    if (schoolId) {
      params = params.append('schoolId', schoolId.toString());
    }
    return this.http.post<Student>(this.apiUrl, studentData, { params });
  }

  updateStudent(studentId: number, studentData: Partial<StudentData>, schoolId?: number): Observable<Student> {
    let params = new HttpParams();
    if (schoolId) {
      params = params.append('schoolId', schoolId.toString());
    }
    return this.http.put<Student>(`${this.apiUrl}/${studentId}`, studentData, { params });
  }

  deleteStudent(studentId: number, schoolId?: number): Observable<void> {
    let params = new HttpParams();
    if (schoolId) {
      params = params.append('schoolId', schoolId.toString());
    }
    const url = `${this.apiUrl}/${studentId}`;
    console.log('[StudentService] DELETE', url, 'params:', params.toString());
    return this.http.delete<void>(url, { params }).pipe(
      tap(() => console.log('[StudentService] DELETE success for', url)),
      catchError(err => {
        console.error('[StudentService] DELETE error', err?.status, err?.message, err);
        return throwError(() => err);
      })
    );
  }

  upsertStudentTerm(studentId: number, year: number, term: number, presence = true, statusAtTerm?: string, classAtTerm?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${studentId}/terms`, { year, term, presence, status_at_term: statusAtTerm, class_name_at_term: classAtTerm });
  }

  sendSms(studentId: number, message: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${studentId}/sms`, { message });
  }
}