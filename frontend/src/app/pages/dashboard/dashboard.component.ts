import { Component, OnInit, inject } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { School, SchoolService } from '../../services/school.service';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SchoolEditModalComponent } from '../../components/school-edit-modal/school-edit-modal.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, SchoolEditModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  school$: Observable<School | null> | undefined;
  schools: School[] = [];
  selectedSchool: School | null = null;
  showEditModal = false;

  private authService = inject(AuthService);
  // dialog/snack removed - using parent-driven modal and bootstrap/sweetalert for messages
  private subs: Subscription[] = [];
  constructor(private schoolService: SchoolService, public router: Router) { }

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    if (user && user.role === 'Teacher') {
      // Fail-safe: If a teacher lands here, redirect immediately to their dashboard
      this.router.navigate(['/teacher']);
      return;
    }

    this.school$ = this.schoolService.getMySchool();
    // Force refresh schools list to ensure fresh data from API
    this.refreshSchools(true);

    this.subs.push(this.authService.authState$?.subscribe(loggedIn => {
      // refresh when auth changes
      if (loggedIn) this.refreshSchools(true);
    }) as Subscription);

    // refresh when user re-navigates to /dashboard within the SPA
    this.subs.push(this.router.events.subscribe(evt => {
      if (evt instanceof NavigationEnd && evt.urlAfterRedirects && evt.urlAfterRedirects.startsWith('/dashboard')) {
        this.refreshSchools(true);
      }
    }) as Subscription);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  public refreshSchools(forceRefresh = false): void {
    this.schoolService.listMySchools(forceRefresh).subscribe(s => this.schools = s || []);
  }

  public seeSchools(): void {
    // If there are no schools, show helpful prompt and offer to navigate to create
    if (!this.schools || this.schools.length === 0) {
      const go = window.confirm('No schools yet. Create a new school account now?');
      if (go) this.router.navigate(['/create-school']);
      return;
    }

    // otherwise refresh and focus the schools area
    this.refreshSchools();
  }

  navigateToSubscription(): void {
    this.router.navigate(['/subscription']);
  }

  navigateToCommunications(): void {
    this.router.navigate(['/communications']);
  }

  logout(): void {
    // call the shared AuthService logout which clears local session and redirects to login
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  openSchool(s: School): void {
    // default action: navigate to manage-school and show sidenav
    // select the school in the service so shell/sidenav can react
    this.schoolService.selectSchool(s);
    this.router.navigate(['/manage-school'], { queryParams: { id: s.school_id } });
  }

  editSchool(s: School): void {
    // show parent-driven edit modal
    this.selectedSchool = s;
    this.showEditModal = true;
  }

  onSchoolSaved(updated: School) {
    this.showEditModal = false;
    this.selectedSchool = null;
    // refresh list to reflect changes
    this.refreshSchools();
  }

  onEditClosed() {
    this.showEditModal = false;
    this.selectedSchool = null;
  }

  getSchoolColor(id: string | number): string {
    // deterministic pastel color generator based on id
    const hash = String(id).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const hue = hash % 360;
    return `linear-gradient(135deg, hsl(${hue} 70% 80%), hsl(${(hue + 30) % 360} 70% 72%))`;
  }
}