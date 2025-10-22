import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);
  // Allow callers to opt-out of the global loading overlay by setting header
  const skipGlobal = req.headers.get('X-Skip-Global-Loading') === 'true';
  if (!skipGlobal) {
    loadingService.show();
  }
  return next(req).pipe(
    finalize(() => {
      if (!skipGlobal) {
        loadingService.hide();
      }
    })
  );
};