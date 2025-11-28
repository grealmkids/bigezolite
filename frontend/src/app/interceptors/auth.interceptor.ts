import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { SchoolService } from '../services/school.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const schoolService = inject(SchoolService);
  const token = authService.getToken();
  const schoolId = schoolService.getSelectedSchoolId();

  let headers = req.headers;

  if (token) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }

  if (schoolId) {
    headers = headers.set('x-school-id', schoolId.toString());
  }

  const cloned = req.clone({ headers });
  return next(cloned);
};