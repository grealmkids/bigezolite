
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
  account_status: 'Dormant' | 'Active' | 'Suspended';
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

  constructor(private http: HttpClient) {
    // Restore selected school from localStorage if present
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as School;
        this.selectedSchool.next(parsed);
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
    this.selectedSchool.next(school);
    try {
      if (school) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(school));
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    } catch (e) {
      // ignore storage errors
    }
  }

  deleteMySchool(id: number) {
    return this.http.delete<School>(`${this.apiUrl}/schools/${id}`).pipe(
      tap(() => this.mySchool.next(null))
    );
  }
}
