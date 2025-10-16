import { Component, OnInit, inject } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { School, SchoolService } from '../../services/school.service';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SchoolEditModalComponent } from '../../components/school-edit-modal/school-edit-modal.component';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatDialogModule, MatIconModule, MatSnackBarModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  school$: Observable<School | null> | undefined;
  schools: School[] = [];

  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private subs: Subscription[] = [];
  constructor(private schoolService: SchoolService, public router: Router) { }

  ngOnInit(): void {
    this.school$ = this.schoolService.getMySchool();
    // Ensure schools refresh immediately when route loads and when auth state changes
    this.refreshSchools();
    // small delay to catch cases where navigation happens right after login
    setTimeout(() => this.refreshSchools(), 50);

    this.subs.push(this.authService.authState$?.subscribe(loggedIn => {
      // refresh when auth changes
      if (loggedIn) this.refreshSchools();
    }) as Subscription);

    // refresh when user re-navigates to /dashboard within the SPA
    this.subs.push(this.router.events.subscribe(evt => {
      if (evt instanceof NavigationEnd && evt.urlAfterRedirects && evt.urlAfterRedirects.startsWith('/dashboard')) {
        this.refreshSchools();
      }
    }) as Subscription);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  public refreshSchools(): void {
    this.schoolService.listMySchools().subscribe(s => this.schools = s || []);
  }

  public seeSchools(): void {
    // If there are no schools, show helpful prompt and offer to navigate to create
    if (!this.schools || this.schools.length === 0) {
      const ref = this.snack.open('No schools yet, create new school account', 'Create', { duration: 5000 });
      ref.onAction().subscribe(() => this.router.navigate(['/create-school']));
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
    // open an edit modal
    const ref = this.dialog.open(SchoolEditModalComponent, { data: { school: s }, width: '520px' });
    ref.afterClosed().subscribe(updated => {
      // always refresh list to reflect any changes made in the modal
      this.refreshSchools();
    });
  }

  getSchoolColor(id: string | number): string {
    // deterministic pastel color generator based on id
    const hash = String(id).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const hue = hash % 360;
    return `linear-gradient(135deg, hsl(${hue} 70% 80%), hsl(${(hue + 30) % 360} 70% 72%))`;
  }
}