import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, BehaviorSubject } from 'rxjs';
import { Auth, signInWithPopup, GoogleAuthProvider } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/v1'; // Assuming backend runs on port 3000
  private tokenKey = 'bigezo_auth_token';
  private auth: Auth = inject(Auth);
  private authState = new BehaviorSubject<boolean>(!!this.getToken());
  public authState$ = this.authState.asObservable();

  constructor(private http: HttpClient) { }

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
  // Backend didn't return an app token. Do NOT save the raw Firebase ID token
  // as the application's auth token — our server expects a HS256 app token and
  // attempting to save the Firebase token causes server-side JWT verification
  // to fail with algorithm errors. Instead, return the firebase user info so
  // the caller can decide what to do (e.g., prompt to register).
  return { user: result.user, idToken: null };
      } catch (err: any) {
        console.error('Failed to exchange ID token with backend:', err);
        if (err?.status === 404) {
          // Signal to caller that the Google account has no corresponding app account
          // Include the email so the UI can pre-fill registration.
          const email = result.user?.email || null;
          // store temporarily in localStorage for navigation fallback
          if (email) localStorage.setItem('bigezo_google_email', email);
          throw { code: 'NO_ACCOUNT', message: 'No existing account found for this Google email.', email };
        }
  // Do not persist the idToken when exchange fails; rethrow a clear error so
  // the UI can surface the server response (if any) or a friendly generic error.
  throw { code: 'EXCHANGE_FAILED', message: 'Failed to exchange ID token with backend.' };
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      // Re-throw so callers (components) can detect the error and handle it
      throw error;
    }
  }

  saveToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
    this.authState.next(true);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.authState.next(false);
  }
}