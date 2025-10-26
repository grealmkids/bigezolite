import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { SchoolService } from '../../services/school.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatIconModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string | null = null;
  showRegisterCTA = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
    , private schoolService: SchoolService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.email]],
      phoneNumber: [''],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    document.body.classList.add('auth-bg');
    // Ensure any leftover client-side state is cleared when loading the login page
    // so the user starts with a clean session (localStorage, sessionStorage, caches).
    try {
      this.authService.clearClientData()?.catch?.(() => {});
    } catch (e) {
      // ignore errors during cleanup
      console.debug('Login init: clearClientData failed', e);
    }
  }

  ngOnDestroy(): void {
    document.body.classList.remove('auth-bg');
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.errorMessage = null;
    const credentials = this.loginForm.value;

    this.authService.login(credentials).subscribe({
      next: () => {
        // After login, prefetch the schools for the user so dashboard buttons are ready.
        // Force refresh the cached list to ensure latest data.
        this.schoolService.listMySchools(true).subscribe({
          next: () => this.router.navigate(['/dashboard']),
          error: (err) => {
            // If fetching schools fails, still navigate to dashboard but log the error.
            console.error('Failed to prefetch schools after login:', err);
            this.router.navigate(['/dashboard']);
          }
        });
      },
      error: (err) => {
        // Basic error handling
        if (err.status === 401) {
          this.errorMessage = 'Invalid email or password.';
        } else {
          this.errorMessage = 'An unexpected error occurred. Please try again.';
        }
        console.error(err);
      }
    });
  }

  onGoogleSignIn(): void {
    this.errorMessage = null;
    this.showRegisterCTA = false;
    this.authService.googleSignIn()
      .then(() => this.router.navigate(['/dashboard']))
      .catch((err: any) => {
        console.error('Google sign-in failed (login page):', err);
        if (err?.code === 'NO_ACCOUNT') {
          this.errorMessage = 'No account exists for this Google email.';
          this.showRegisterCTA = true;
          // navigate to register with email prefilled (if provided)
          const email = err.email || localStorage.getItem('bigezo_google_email');
          if (email) {
            this.router.navigate(['/register'], { queryParams: { email, via: 'google' } });
          }
          return;
        }
        this.errorMessage = 'Google sign-in failed. Check console for details.';
      });
  }

  navigateToRegister(): void {
    this.router.navigate(['/register']);
  }
}