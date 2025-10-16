import { Component, OnInit, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { School, SchoolService } from '../../services/school.service';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SchoolEditModalComponent } from '../../components/school-edit-modal/school-edit-modal.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatDialogModule, SchoolEditModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  school$: Observable<School | null> | undefined;
  schools: School[] = [];

  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  constructor(private schoolService: SchoolService, public router: Router) { }

  ngOnInit(): void {
    this.school$ = this.schoolService.getMySchool();
    this.schoolService.listMySchools().subscribe(s => this.schools = s || []);
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
    this.router.navigate(['/manage-school'], { queryParams: { id: s.school_id } });
  }

  editSchool(s: School): void {
    // open an edit modal
    const ref = this.dialog.open(SchoolEditModalComponent, { data: { school: s }, width: '520px' });
    ref.afterClosed().subscribe(updated => {
      if (updated) {
        // refresh local list
        this.schoolService.listMySchools(true).subscribe();
      }
    });
  }

  getSchoolColor(id: string | number): string {
    // deterministic pastel color generator based on id
    const hash = String(id).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const hue = hash % 360;
    return `linear-gradient(135deg, hsl(${hue} 70% 80%), hsl(${(hue + 30) % 360} 70% 72%))`;
  }
}