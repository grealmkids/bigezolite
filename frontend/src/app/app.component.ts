
import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { AuthService } from './services/auth.service';
import { WebSocketService } from './services/websocket.service';
import { SchoolService } from './services/school.service';

// Angular Material Modules
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    LoadingSpinnerComponent,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'bigezo';
  private authService = inject(AuthService);
  private router = inject(Router);
  private webSocketService = inject(WebSocketService);
  private schoolService = inject(SchoolService);
  hasSchool = false;

  ngOnInit(): void {
    this.webSocketService.getMessages().subscribe((message: any) => {
      if (message.type === 'PAYMENT_SUCCESS') {
        // Refresh school data
        this.schoolService.getMySchool(true);
      }
    });

    // Initialize whether the current user has at least one school to show sidenav
    this.schoolService.listMySchools().subscribe(schools => {
      this.hasSchool = !!(schools && schools.length > 0);
    });
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
