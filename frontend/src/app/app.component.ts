
import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { Router, RouterOutlet, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { AuthService } from './services/auth.service';
import { WebSocketService } from './services/websocket.service';
import { SchoolService } from './services/school.service';

// Angular Material Modules
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommunicationService } from './services/communication.service';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

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
    ,MatSnackBarModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'bigezo';
  private authService = inject(AuthService);
  public router = inject(Router);
  private webSocketService = inject(WebSocketService);
  public schoolService = inject(SchoolService);
  private communicationService = inject(CommunicationService);
  private snack = inject(MatSnackBar);
  hasSchool = false;
  showSidenav = true;
  private subs: Subscription[] = [];

  @ViewChild('sidenav') sidenav!: MatSidenav;

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

    // If another component selects a school, open the sidenav and mark hasSchool
    this.subs.push(this.schoolService.selectedSchool$.subscribe(s => {
      if (s) {
        this.hasSchool = true;
        this.showSidenav = true;
        try {
          // ViewChild may not be ready immediately; guard
          if (this.sidenav && !this.sidenav.opened) this.sidenav.open();
        } catch (ex) {
          // ignore; best-effort
        }
      }
    }));

    // Hide sidenav for the top-level dashboard route so the landing dashboard is a simple card grid
    this.router.events.subscribe(() => {
      const url = this.router.url.split('?')[0];
      this.showSidenav = !(url === '/dashboard');
    });
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // Called from template to quickly check SMS balance (delegates to CommunicationService)
  checkBalance(): void {
    try {
      this.communicationService.fetchSmsCreditBalance();
      // show the latest value once
      this.communicationService.smsCreditBalance$.pipe(take(1)).subscribe(bal => {
        const formatted = (typeof bal === 'number') ? bal.toLocaleString() : String(bal);
        this.snack.open(`SMS Balance: ${formatted}`, 'Close', {
          verticalPosition: 'top',
          horizontalPosition: 'center',
          panelClass: ['sms-balance-snackbar']
        });
      });
    } catch (e) {
      this.snack.open('Failed to check balance', 'Dismiss', { duration: 3000 });
    }
  }
}
