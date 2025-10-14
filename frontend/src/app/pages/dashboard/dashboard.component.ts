import { Component, OnInit, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { School, SchoolService } from '../../services/school.service';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  school$: Observable<School | null> | undefined;
  schools: School[] = [];

  private authService = inject(AuthService);
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
}