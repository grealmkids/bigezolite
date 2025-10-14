import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

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
    return this.http.get<Student[]>(this.apiUrl, { params });
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