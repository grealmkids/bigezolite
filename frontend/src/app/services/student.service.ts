import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface Student {
  student_id: number;
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
  getStudentById(studentId: number): Observable<Student> {
    return this.http.get<Student>(`${this.apiUrl}/${studentId}`);
  }
  private apiUrl = 'http://localhost:3000/api/v1/students';

  constructor(private http: HttpClient) { }

  getStudents(searchTerm?: string, classTerm?: string, statusTerm?: string, yearTerm?: string): Observable<Student[]> {
    let params = new HttpParams();
    if (searchTerm) {
      params = params.append('search', searchTerm);
    }
    if (classTerm) {
      params = params.append('class', classTerm);
    }
    if (statusTerm) {
      params = params.append('status', statusTerm);
    }
    if (yearTerm) {
      params = params.append('year', yearTerm);
    }
    const url = this.apiUrl;
    console.log('[StudentService] GET', url, 'params:', params.toString());
    return this.http.get<Student[]>(url, { params }).pipe(
      tap(() => {
        // successful request
      }),
      catchError(err => {
        console.error('[StudentService] HTTP error while fetching students', err.status, err.message, err);
        // surface 403 details for easier debugging
        if (err.status === 403) {
          console.warn('[StudentService] 403 Forbidden received. Check auth token and backend permissions.');
        }
        return throwError(() => err);
      })
    );
  }

  createStudent(studentData: StudentData): Observable<Student> {
    return this.http.post<Student>(this.apiUrl, studentData);
  }

  updateStudent(studentId: number, studentData: Partial<StudentData>): Observable<Student> {
    return this.http.put<Student>(`${this.apiUrl}/${studentId}`, studentData);
  }

  deleteStudent(studentId: number): Observable<void> {
    // Soft delete by updating status to 'Inactive'
    return this.http.patch<void>(`${this.apiUrl}/${studentId}/status`, { status: 'Inactive' });
  }

  sendSms(studentId: number, message: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${studentId}/sms`, { message });
  }
}