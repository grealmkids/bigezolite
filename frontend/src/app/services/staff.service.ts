import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Staff {
    staff_id?: number;
    school_id: number;
    first_name: string;
    last_name: string;
    gender: 'Male' | 'Female';
    email: string;
    phone: string;
    role: 'Teacher' | 'Class Teacher' | 'Accountant' | 'IT' | 'Canteen' | 'Other';
    photo_url?: string;
    is_active: boolean;
    allow_password_login: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class StaffService {
    private apiUrl = `${environment.apiUrl}/staff`; // e.g. http://localhost:3000/api/v1/staff
    private http = inject(HttpClient);

    getStaff(schoolId: number): Observable<Staff[]> {
        const params = new HttpParams().set('school_id', schoolId.toString());
        return this.http.get<Staff[]>(this.apiUrl, { params });
    }

    getStaffById(id: number, schoolId: number): Observable<Staff> {
        const params = new HttpParams().set('school_id', schoolId.toString());
        return this.http.get<Staff>(`${this.apiUrl}/${id}`, { params });
    }

    createStaff(staff: Staff): Observable<Staff> {
        return this.http.post<Staff>(this.apiUrl, staff);
    }

    updateStaff(id: number, schoolId: number, updates: Partial<Staff>): Observable<Staff> {
        // Backend expects school_id in body for validation/scoping
        return this.http.put<Staff>(`${this.apiUrl}/${id}`, { ...updates, school_id: schoolId });
    }

    deleteStaff(id: number, schoolId: number): Observable<void> {
        const params = new HttpParams().set('school_id', schoolId.toString());
        return this.http.delete<void>(`${this.apiUrl}/${id}`, { params });
    }

    // Assignments
    // Assignments
    assignSubject(staffId: number, schoolId: number, subjectId: number, classLevel: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/assignments/subject`, { staff_id: staffId, school_id: schoolId, subject_id: subjectId, class_level: classLevel });
    }

    assignClass(staffId: number, schoolId: number, className: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/assignments/class`, { staff_id: staffId, school_id: schoolId, class_name: className });
    }

    getStaffAssignments(staffId: number, schoolId: number): Observable<{ subjects: any[], classes: any[] }> {
        const params = new HttpParams().set('school_id', schoolId.toString());
        return this.http.get<{ subjects: any[], classes: any[] }>(`${this.apiUrl}/${staffId}/assignments`, { params });
    }

    uploadStaffPhoto(staffId: number, file: File): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post(`${this.apiUrl}/${staffId}/photo`, formData, {
            reportProgress: true,
            observe: 'events'
        });
    }

    deleteSubjectAssignment(assignmentId: number, schoolId: number): Observable<void> {
        const params = new HttpParams().set('school_id', schoolId.toString());
        return this.http.delete<void>(`${this.apiUrl}/assignments/subject/${assignmentId}`, { params });
    }

    deleteClassAssignment(assignmentId: number, schoolId: number): Observable<void> {
        const params = new HttpParams().set('school_id', schoolId.toString());
        return this.http.delete<void>(`${this.apiUrl}/assignments/class/${assignmentId}`, { params });
    }
}
