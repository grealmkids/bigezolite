import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { CreateSchoolComponent } from './pages/create-school/create-school.component';
import { StudentManagementComponent } from './pages/student-management/student-management.component';
import { SubscriptionComponent } from './pages/subscription/subscription.component';
import { CommunicationsComponent } from './pages/communications/communications.component';
import { ManageSchoolComponent } from './pages/manage-school/manage-school.component';
import { BulkFeesRemindersComponent } from './pages/bulk-fees-reminders/bulk-fees-reminders.component';
import { AnalyticsComponent } from './pages/analytics/analytics.component';
import { authGuard } from './guards/auth.guard';
import { FeesToTrackComponent } from './pages/fees-to-track/fees-to-track.component';
import { TermsComponent } from './pages/terms/terms.component';
import { MarksDashboardComponent } from './pages/marks/marks-dashboard.component';
import { CreateExamSetComponent } from './pages/marks/create-exam-set.component';
import { BulkUploadMarksComponent } from './pages/marks/bulk-upload-marks.component';
import { ManageSubjectsComponent } from './pages/marks/manage-subjects.component';
import { GradingConfigComponent } from './pages/marks/grading-config.component';
import { GenerateReportsComponent } from './pages/marks/generate-reports.component';
import { EnterMarksComponent } from './pages/marks/enter-marks.component';
import { StudentMarksViewerComponent } from './pages/marks/student-marks-viewer.component';

import { StudentReportComponent } from './pages/marks/student-report.component';
import { HolisticFeedbackComponent } from './pages/marks/holistic-feedback.component';
import { ManageAssessmentElementsComponent } from './pages/marks/manage-assessment-elements.component';
import { StaffListComponent } from './pages/staff-management/staff-list.component';

import { HomeComponent } from './pages/home/home.component';

export const routes: Routes = [
    { path: '', component: HomeComponent },
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
    {
        path: 'staff-management',
        component: StaffListComponent,
        canActivate: [authGuard]
    },
    {
        path: 'bulk-fees-reminders',
        component: BulkFeesRemindersComponent,
        canActivate: [authGuard]
    },
    {
        path: 'analytics',
        component: AnalyticsComponent,
        canActivate: [authGuard]
    },
    {
        path: 'fees-to-track',
        component: FeesToTrackComponent,
        canActivate: [authGuard]
    },
    {
        path: 'marks',
        component: MarksDashboardComponent,
        canActivate: [authGuard]
    },
    {
        path: 'marks/create-exam-set',
        component: CreateExamSetComponent,
        canActivate: [authGuard]
    },
    {
        path: 'marks/bulk-upload',
        component: BulkUploadMarksComponent,
        canActivate: [authGuard]
    },
    {
        path: 'marks/subjects',
        component: ManageSubjectsComponent,
        canActivate: [authGuard]
    },
    {
        path: 'marks/assessment-elements',
        component: ManageAssessmentElementsComponent,
        canActivate: [authGuard]
    },
    {
        path: 'marks/grading',
        component: GradingConfigComponent,
        canActivate: [authGuard]
    },
    {
        path: 'marks/reports',
        component: GenerateReportsComponent,
        canActivate: [authGuard]
    },
    {
        path: 'marks/enter-marks/:examSetId',
        component: EnterMarksComponent,
        canActivate: [authGuard]
    },
    {
        path: 'marks/view-marks',
        component: StudentMarksViewerComponent,
        canActivate: [authGuard]
    },

    {
        path: 'marks/student-report/:examSetId/:studentId',
        component: StudentReportComponent,
        canActivate: [authGuard]
    },
    {
        path: 'marks/holistic-feedback/:examSetId',
        component: HolisticFeedbackComponent,
        canActivate: [authGuard]
    },
    {
        path: 'teacher',
        loadComponent: () => import('./pages/teacher-dashboard/teacher-dashboard.component').then(m => m.TeacherDashboardComponent),
        canActivate: [authGuard]
    },
    {
        path: 'promotions',
        loadComponent: () => import('./pages/promotions/promotions.component').then(m => m.PromotionsComponent),
        canActivate: [authGuard]
    },
    { path: 'terms', component: TermsComponent },
    // Add a catch-all route to redirect to dashboard or login
    { path: '**', redirectTo: '/dashboard' }
];
