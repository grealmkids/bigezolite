
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface School {
  school_id: number;
  user_id: number;
  school_name: string;
  admin_phone: string;
  location_district: string;
  student_count_range: string;
  school_type: string;
  accountant_number?: string; // RSVP/Mobile Money number
  account_status: 'Dormant' | 'Active' | 'Suspended';
  badge_url?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SchoolService {
  private apiUrl = 'http://localhost:3000/api/v1'; // Assuming backend runs on port 3000
  private mySchool = new BehaviorSubject<School | null>(null);
  private mySchools = new BehaviorSubject<School[] | null>(null);
  private selectedSchool = new BehaviorSubject<School | null>(null);
  public selectedSchool$ = this.selectedSchool.asObservable();
  private readonly STORAGE_KEY = 'bigezo_selected_school';
  private readonly STORAGE_SCHOOL_TYPE = 'bigezo_selected_school_type';
  private selectedSchoolType = new BehaviorSubject<string | null>(null);
  public selectedSchoolType$ = this.selectedSchoolType.asObservable();

  constructor(private http: HttpClient) {
    // Restore selected school from localStorage if present
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as School;
        this.selectedSchool.next(parsed);
        // also restore school type if present
        if (parsed && parsed.school_type) {
          this.selectedSchoolType.next(parsed.school_type);
          try { localStorage.setItem(this.STORAGE_SCHOOL_TYPE, parsed.school_type); } catch (e) { /* ignore */ }
        } else {
          const st = localStorage.getItem(this.STORAGE_SCHOOL_TYPE);
          if (st) { this.selectedSchoolType.next(st); }
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  /**
   * Gets the school associated with the currently authenticated user.
   * @returns An Observable of the School object or null if not found.
   */
  getMySchool(forceRefresh = false): Observable<School | null> {
    if (this.mySchool.value && !forceRefresh) {
      return of(this.mySchool.value);
    }

    return this.http.get<School>(`${this.apiUrl}/schools/my-school`).pipe(
      catchError(error => {
        // If the error is a 404, it means the user hasn't created a school yet.
        // We can return null to signify this.
        if (error.status === 404) {
          return of(null);
        }
        // For other errors, we might want to log them or handle them differently.
        console.error('Error fetching school data:', error);
        throw error; // Re-throw other errors
      }),
      tap(school => {
        this.mySchool.next(school);
      })
    );
  }

  /**
   * Get all schools associated with the current user.
   */
  listMySchools(forceRefresh = false) {
    if (this.mySchools.value && !forceRefresh) {
      return of(this.mySchools.value);
    }

    return this.http.get<School[]>(`${this.apiUrl}/schools`).pipe(
      catchError(err => {
        console.error('Error fetching schools list:', err);
        return of([] as School[]);
      }),
      tap(schools => this.mySchools.next(schools))
    );
  }

  /**
   * Creates a new school for the authenticated user.
   * @param schoolData The data for the new school.
   * @returns An Observable of the created School object.
   */
  createSchool(schoolData: Omit<School, 'school_id' | 'user_id' | 'account_status'>): Observable<School> {
    return this.http.post<School>(`${this.apiUrl}/schools`, schoolData).pipe(
      tap(school => {
        this.mySchool.next(school);
      })
    );
  }

  updateMySchool(id: number, updates: Partial<School>) {
    return this.http.put<School>(`${this.apiUrl}/schools/${id}`, updates).pipe(
      tap(school => {
        this.mySchool.next(school);
        // if the updated school is currently selected, update the selectedSchool as well
        const cur = this.selectedSchool.value;
        if (cur && cur.school_id === school.school_id) {
          this.selectedSchool.next(school);
          try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(school)); } catch (e) { /* ignore */ }
        }
        // update schools list cache so UI updates immediately
        const list = this.mySchools.value || [];
        const idx = list.findIndex(ss => ss.school_id === school.school_id);
        if (idx !== -1) {
          list[idx] = school;
          this.mySchools.next([...list]);
        }
      })
    );
  }

  selectSchool(school: School | null) {
    try {
      if (school) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(school));
        if (school.school_type) {
          this.selectedSchoolType.next(school.school_type);
          try { localStorage.setItem(this.STORAGE_SCHOOL_TYPE, school.school_type); } catch (e) { /* ignore */ }
        }
        this.switchSchool(school.school_id).subscribe();
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
        try { localStorage.removeItem(this.STORAGE_SCHOOL_TYPE); } catch (e) { /* ignore */ }
        this.selectedSchoolType.next(null);
      }
    } catch (e) {
      // ignore storage errors
    }
    // Emit selectedSchool AFTER updating schoolType so subscribers (like StudentMarksViewer)
    // can access the correct schoolType immediately.
    this.selectedSchool.next(school);
  }

  switchSchool(schoolId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/schools/switch`, { schoolId });
  }


  /**
   * Returns the currently selected school's type (synchronously) if available.
   * Falls back to reading the persisted storage key.
   */
  getSelectedSchoolType(): string | null {
    const v = this.selectedSchoolType.value;
    if (v) { return v; }
    try {
      return localStorage.getItem(this.STORAGE_SCHOOL_TYPE);
    } catch (e) { return null; }
  }

  /**
   * Returns the currently selected school's ID (synchronously) if available.
   * Falls back to reading the persisted storage key.
   */
  getSelectedSchoolId(): number | null {
    const school = this.selectedSchool.value;
    if (school && school.school_id) return school.school_id;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.school_id || null;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  deleteMySchool(id: number) {
    return this.http.delete<School>(`${this.apiUrl}/schools/${id}`).pipe(
      tap(() => this.mySchool.next(null))
    );
  }

  uploadBadge(schoolId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/schools/${schoolId}/badge`, formData, {
      reportProgress: true,
      observe: 'events'
    });
  }
}
