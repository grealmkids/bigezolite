import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, BehaviorSubject } from 'rxjs';
import { Auth, signInWithPopup, GoogleAuthProvider } from '@angular/fire/auth';
import { jwtDecode } from 'jwt-decode';

export interface User {
  userId: number;
  email: string;
  role: string;
  school_id: number;
  // Add other fields from your JWT payload
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/v1'; // Assuming backend runs on port 3000
  private tokenKey = 'bigezo_auth_token';
  private auth: Auth = inject(Auth);
  private authState = new BehaviorSubject<boolean>(!!this.getToken());
  public authState$ = this.authState.asObservable();

  private currentUserSubject = new BehaviorSubject<User | null>(null);

  constructor(private http: HttpClient) {
    if (this.getToken()) {
      this.decodeToken();
    }
  }

  public get currentUserValue(): User | null {
    if (!this.currentUserSubject.value) {
      this.decodeToken();
    }
    return this.currentUserSubject.value;
  }

  private decodeToken(): void {
    const token = this.getToken();
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        // Ensure field mapping matches your Backend JWT payload
        this.currentUserSubject.next({
          userId: decoded.userId || decoded.id || decoded.staff_id,
          email: decoded.email,
          role: decoded.role,
          school_id: decoded.school_id
        });
      } catch (e) {
        console.error('Invalid token', e);
        this.currentUserSubject.next(null);
      }
    } else {
      this.currentUserSubject.next(null);
    }
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/users/register`, userData);
  }

  login(credentials: any): Observable<any> {
    // Send only provided fields (avoid sending empty email when logging in by phone)
    const payload: any = { password: credentials.password };
    if (credentials.email) payload.email = credentials.email;
    if (credentials.phoneNumber) payload.phoneNumber = credentials.phoneNumber;

    return this.http.post<{ token: string }>(`${this.apiUrl}/users/login`, payload).pipe(
      tap(response => this.saveToken(response.token))
    );
  }

  staffLogin(credentials: any): Observable<any> {
    return this.http.post<{ token: string }>(`${this.apiUrl}/auth/staff/login`, credentials).pipe(
      tap(response => this.saveToken(response.token))
    );
  }

  async googleSignIn() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(this.auth, provider);
      console.log('Firebase sign-in result:', result.user);
      // Get the Firebase ID token (JWT issued by Firebase) - useful to send to backend
      const idToken = await result.user.getIdToken();
      console.log('Firebase ID token obtained (first 40 chars):', idToken?.slice?.(0, 40));

      // Exchange the Firebase ID token with backend for an application JWT
      try {
        const resp: any = await this.http.post(`${this.apiUrl}/auth/google`, { idToken }).toPromise();
        if (resp?.token) {
          this.saveToken(resp.token);
          return { user: result.user, token: resp.token };
        }
        // Backend didn't return an app token.
        return { user: result.user, idToken: null };
      } catch (err: any) {
        console.error('Failed to exchange ID token with backend:', err);
        if (err?.status === 404) {
          const email = result.user?.email || null;
          if (email) localStorage.setItem('bigezo_google_email', email);
          // Pass idToken so we can replay the request with createAccount: true
          throw { code: 'NO_ACCOUNT', message: 'No existing account found for this Google email.', email, idToken };
        }
        throw { code: 'EXCHANGE_FAILED', message: 'Failed to exchange ID token with backend.' };
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  }

  async completeGoogleSignUp(idToken: string) {
    try {
      const resp: any = await this.http.post(`${this.apiUrl}/auth/google`, { idToken, createAccount: true }).toPromise();
      if (resp?.token) {
        this.saveToken(resp.token);
        return { token: resp.token };
      }
      throw new Error('No token returned from backend creation.');
    } catch (err: any) {
      console.error('Failed to complete google sign up:', err);
      throw err;
    }
  }

  async staffGoogleSignIn() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(this.auth, provider);
      const idToken = await result.user.getIdToken();

      const payload = {
        email: result.user.email,
        googleUid: result.user.uid,
        idToken // Keeping idToken just in case backend evolves to verify it
      };

      try {
        const resp: any = await this.http.post(`${this.apiUrl}/auth/staff/google`, payload).toPromise();
        if (resp?.token) {
          this.saveToken(resp.token);
          return { user: result.user, token: resp.token };
        }
        return { user: result.user, idToken: null };
      } catch (err: any) {
        console.error('Failed to exchange ID token with backend (Staff):', err);
        throw { code: 'EXCHANGE_FAILED', message: 'Failed to exchange ID token with backend.' };
      }
    } catch (error) {
      console.error('Google sign-in error (Staff):', error);
      throw error;
    }
  }

  saveToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
    this.decodeToken();
    this.authState.next(true);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    if (typeof window !== 'undefined') {
      try {
        if ('caches' in window) {
          caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))).catch(() => { });
        }
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
          navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => { });
        }
      } catch (err) {
        console.debug('Failed to clear caches/service-workers during logout:', err);
      }
    }
    this.authState.next(false);
  }

  async clearClientData(): Promise<void> {
    try {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      if (typeof window !== 'undefined') {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      }
    } catch (err) {
      console.debug('clearClientData error:', err);
    }
  }
}