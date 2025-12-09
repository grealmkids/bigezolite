import { Component, OnInit, OnDestroy } from '@angular/core';
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
  // so the user starts with a clean session (localStorage, sessionStorage, caches).
  try {
    this.authService.clearClientData()?.catch?.(() => { });
  } catch(e) {
    // ignore errors during cleanup
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

  // Adjust validators based on role
  if(role === 'staff') {
  this.loginForm.get('email')?.setValidators([Validators.required, Validators.email]);
  this.loginForm.get('phoneNumber')?.clearValidators();
} else {
  this.loginForm.get('email')?.setValidators([Validators.email]);
  // Admin can use phone or email, so no strict required on email alone
}
this.loginForm.get('email')?.updateValueAndValidity();
this.loginForm.get('phoneNumber')?.updateValueAndValidity();
    }

onSubmit(): void {
  if(this.loginForm.invalid) {
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
  // If staff, we don't need to list "my schools" as they don't own any.
  // Just redirect immediately.
  if(this.role === 'staff') {
  this.redirectBasedOnRole();
  return;
}

// For admins, prefetch schools.
this.schoolService.listMySchools(true).subscribe({
  next: () => this.redirectBasedOnRole(),
  error: (err) => {
    // If fetching schools fails, still navigate but log the error.
    console.error('Failed to prefetch schools after login:', err);
    this.redirectBasedOnRole();
  }
});
    }

redirectBasedOnRole(): void {
  const user = this.authService.currentUserValue;
  console.log('Redirecting based on role. User:', user); // DEBUG LOG

  if(user) {
    if (user.role === 'Teacher') {
      console.log('Redirecting to /teacher');
      this.router.navigate(['/teacher']);
    } else if (user.role === 'Admin' || user.role === 'admin') { // Handle legacy lowercase admin
      this.router.navigate(['/dashboard']);
    } else if (['Canteen', 'Accountant', 'IT', 'Other'].includes(user.role)) {
      // Placeholder routes for now, or default to generic dashboard/profile
      this.router.navigate([`/${user.role.toLowerCase()}`]).catch(() => {
        this.router.navigate(['/dashboard']); // Fallback
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
  // Basic error handling
  if(err.status === 401) {
  this.errorMessage = 'Invalid email or password.';
} else {
  this.errorMessage = 'An unexpected error occurred. Please try again.';
}
console.error(err);
    }

onGoogleSignIn(): void {
  this.errorMessage = null;
  this.showRegisterCTA = false;

  if(this.role === 'admin') {
  this.authService.googleSignIn()
    .then(() => this.router.navigate(['/dashboard']))
    .catch((err: any) => {
      console.error('Google sign-in failed (login page):', err);

      if (err?.code === 'NO_ACCOUNT') {
        // Intercept here: Show Create School Dialog
        const dialogRef = this.dialog.open(CreateSchoolDialogComponent, {
          width: '400px',
          disableClose: true,
          panelClass: 'create-school-dialog-container'
        });

        dialogRef.afterClosed().subscribe((result: boolean) => {
          if (result && err.idToken) {
            // User confirmed, create account using idToken
            this.authService.completeGoogleSignUp(err.idToken)
              .then(() => {
                // After creation, we need to refresh schools list or just go to dashboard
                // Assuming creation also auto-creates a school row? No, usually just user row.
                // But user said "Create School Account". 
                // Wait, if users table entry is created, they can login.
                // But do they have a school? The backend auto-provisions user. School might need manual creation.
                // But backend googleAuth creates a USER.
                // The requirement "Create School Account" is user facing text.
                this.router.navigate(['/dashboard']);
              })
              .catch(createErr => {
                console.error('Creation failed', createErr);
                this.errorMessage = 'Failed to create account. Please contact support.';
              });
          } else {
            // User cancelled, maybe show message or nothing
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