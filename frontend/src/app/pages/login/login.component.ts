import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { SchoolService } from '../../services/school.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CreateSchoolDialogComponent } from '../../components/create-school-dialog/create-school-dialog.component';

import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatIconModule,
    MatDialogModule,
    MatButtonModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
  errorMessage: string | null = null;
  showRegisterCTA = false;
  role: 'admin' | 'staff' | 'parent' = 'admin';
  hidePassword = true;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private schoolService: SchoolService,
    private dialog: MatDialog
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
    try {
      this.authService.clearClientData()?.catch?.(() => { });
    } catch (e) {
      console.debug('Login init: clearClientData failed', e);
    }
  }

  ngOnDestroy(): void {
    document.body.classList.remove('auth-bg');
  }

  setRole(role: 'admin' | 'staff' | 'parent'): void {
    this.role = role;
    this.errorMessage = null;
    this.showRegisterCTA = false;
    this.loginForm.reset();

    if (role === 'staff') {
      this.loginForm.get('email')?.setValidators([Validators.required, Validators.email]);
      this.loginForm.get('phoneNumber')?.clearValidators();
    } else {
      this.loginForm.get('email')?.setValidators([Validators.email]);
    }
    this.loginForm.get('email')?.updateValueAndValidity();
    this.loginForm.get('phoneNumber')?.updateValueAndValidity();
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.errorMessage = null;
    const credentials = this.loginForm.value;

    if (this.role === 'admin') {
      this.authService.login(credentials).subscribe({
        next: () => this.handleLoginSuccess(),
        error: (err) => this.handleLoginError(err)
      });
    } else if (this.role === 'staff') {
      this.authService.staffLogin(credentials).subscribe({
        next: () => this.handleLoginSuccess(),
        error: (err) => this.handleLoginError(err)
      });
    }
  }

  handleLoginSuccess(): void {
    if (this.role === 'staff') {
      this.redirectBasedOnRole();
      return;
    }

    this.schoolService.listMySchools(true).subscribe({
      next: () => this.redirectBasedOnRole(),
      error: (err) => {
        console.error('Failed to prefetch schools after login:', err);
        this.redirectBasedOnRole();
      }
    });
  }

  redirectBasedOnRole(): void {
    const user = this.authService.currentUserValue;
    console.log('Redirecting based on role. User:', user);

    if (user) {
      if (user.role === 'Teacher') {
        this.router.navigate(['/teacher']);
      } else if (user.role === 'Admin' || user.role === 'admin') {
        this.router.navigate(['/dashboard']);
      } else if (['Canteen', 'Accountant', 'IT', 'Other'].includes(user.role)) {
        this.router.navigate([`/${user.role.toLowerCase()}`]).catch(() => {
          this.router.navigate(['/dashboard']);
        });
      } else {
        console.warn(`Unknown role: ${user.role}, defaulting to /dashboard`);
        this.router.navigate(['/dashboard']);
      }
    } else {
      console.warn('No user found in AuthService, defaulting to /dashboard');
      this.router.navigate(['/dashboard']);
    }
  }

  handleLoginError(err: any): void {
    if (err.status === 401) {
      this.errorMessage = 'Invalid email or password.';
    } else {
      this.errorMessage = 'An unexpected error occurred. Please try again.';
    }
    console.error(err);
  }

  onGoogleSignIn(): void {
    this.errorMessage = null;
    this.showRegisterCTA = false;

    if (this.role === 'admin') {
      this.authService.googleSignIn()
        .then(() => this.router.navigate(['/dashboard']))
        .catch((err: any) => {
          console.error('Google sign-in failed (login page):', err);
          if (err?.code === 'NO_ACCOUNT') {
            const dialogRef = this.dialog.open(CreateSchoolDialogComponent, {
              width: '400px',
              disableClose: true,
              panelClass: 'create-school-dialog-container'
            });

            dialogRef.afterClosed().subscribe((result: boolean) => {
              if (result) {
                // User confirmed, redirect to register
                // Check if email is available in error object to pre-fill
                const email = err.email || localStorage.getItem('bigezo_google_email');
                if (email) {
                  this.router.navigate(['/register'], { queryParams: { email, via: 'google' } });
                } else {
                  this.router.navigate(['/register']);
                }
              } else {
                this.errorMessage = 'Account creation cancelled.';
              }
            });
            return;
          }
          this.errorMessage = 'Google sign-in failed. Check console for details.';
        });

    } else if (this.role === 'staff') {
      this.authService.staffGoogleSignIn()
        .then(() => this.router.navigate(['/dashboard']))
        .catch((err: any) => {
          console.error('Google sign-in failed (Staff):', err);
          this.errorMessage = 'Google sign-in failed. Ensure your email is registered as staff.';
        });
    }
  }

  navigateToRegister(): void {
    this.router.navigate(['/register']);
  }
}