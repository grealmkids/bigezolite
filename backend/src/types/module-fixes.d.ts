// Ambient module declarations to help the TS language server resolve local relative imports
// These are non-functional and only intended to remove spurious "Cannot find module" diagnostics


// Wildcard declarations to match relative import specifiers (e.g. './auth.routes')
declare module '*auth.routes' {
  import { Router } from 'express';
  const router: Router;
  export default router;
}

declare module '*auth.controller' {
  import { Request, Response } from 'express';
  export function googleAuth(req: Request, res: Response): Promise<Response>;
  export const __auth_controller_module_marker: boolean;
}
