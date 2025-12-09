import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit, OnDestroy {
  registerForm: FormGroup;
  errorMessage: string | null = null;
  hidePassword = true;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
    , private route: ActivatedRoute
  ) {
    this.registerForm = this.fb.group({
      fullName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    // If navigated from a Google NO_ACCOUNT flow, show an informational message
    const via = this.route.snapshot.queryParamMap.get('via');
    const emailParam = this.route.snapshot.queryParamMap.get('email');
    if (via === 'google') {
      this.errorMessage = 'Complete sign-up to link your Google account to a Bigezo account.';
    }
    // prefill email if provided via query param or localStorage
    const prefillEmail = emailParam || localStorage.getItem('bigezo_google_email');
    if (prefillEmail) {
      this.registerForm.patchValue({ email: prefillEmail });
      // clear the stored email after prefill
      localStorage.removeItem('bigezo_google_email');
    }
  }

  ngAfterViewInit(): void {
    document.body.classList.add('auth-bg');
  }

  ngOnDestroy(): void {
    document.body.classList.remove('auth-bg');
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      return;
    }

    this.errorMessage = null;
    const userData = this.registerForm.value;

    // Ensure we send the backend field names (fullName, phoneNumber)
    this.authService.register(userData).subscribe({
      next: () => {
        this.router.navigate(['/login']); // Redirect to login after successful registration
      },
      error: (err) => {
        if (err?.status === 409) {
          this.errorMessage = err?.error?.message || 'Email already exists.';
        } else if (err?.error?.message) {
          // Show backend-provided message when available
          this.errorMessage = err.error.message;
        } else {
          this.errorMessage = 'An unexpected error occurred. Please try again.';
        }
        console.error('Register error:', err);
      }
    });
  }

  onGoogleSignIn(): void {
    this.errorMessage = null;
    this.authService.googleSignIn()
      .then(() => this.router.navigate(['/dashboard']))
      .catch((err: any) => {
        console.error('Google sign-in failed (register page):', err);
        if (err?.code === 'NO_ACCOUNT') {
          // Navigate to register with a query param so the user knows to finish sign up
          this.router.navigate(['/register'], { queryParams: { via: 'google' } });
          return;
        }
        this.errorMessage = 'Google sign-in failed. Check console for details.';
      });
  }
}
