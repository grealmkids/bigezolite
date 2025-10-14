import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { CreateSchoolComponent } from './pages/create-school/create-school.component';
import { StudentManagementComponent } from './pages/student-management/student-management.component';
import { SubscriptionComponent } from './pages/subscription/subscription.component';
import { CommunicationsComponent } from './pages/communications/communications.component';
import { ManageSchoolComponent } from './pages/manage-school/manage-school.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
    { path: '', redirectTo: '/login', pathMatch: 'full' },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [authGuard]
    },
    {
        path: 'create-school',
        component: CreateSchoolComponent,
        canActivate: [authGuard]
    },
    {
        path: 'students',
        component: StudentManagementComponent,
        canActivate: [authGuard]
    },
    {
        path: 'subscription',
        component: SubscriptionComponent,
        canActivate: [authGuard]
    },
    {
        path: 'communications',
        component: CommunicationsComponent,
        canActivate: [authGuard]
    },
    {
        path: 'manage-school',
        component: ManageSchoolComponent,
        canActivate: [authGuard]
    },
    // Add a catch-all route to redirect to dashboard or login
    { path: '**', redirectTo: '/dashboard' }
];