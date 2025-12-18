import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { VeConfigurationService } from './ve-configuration.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, MatTooltipModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private cfg = inject(VeConfigurationService);
  private router = inject(Router);
  
  ngOnInit(): void {
    this.cfg.initVeContext().subscribe({
      next: (sshs) => {
        // Check if no SSH configs exist or no current SSH config is set
        if (!sshs || sshs.length === 0 || !sshs.some(ssh => ssh.current === true)) {
          // Only navigate if we're not already on the ssh-config page
          const currentUrl = this.router.url;
          if (!currentUrl.startsWith('/ssh-config')) {
            this.router.navigate(['/ssh-config']);
          }
        }
      },
      error: (err) => {
        console.warn('Failed to initialize VE context', err);
        // On error, navigate to ssh-config page if not already there
        const currentUrl = this.router.url;
        if (!currentUrl.startsWith('/ssh-config')) {
          this.router.navigate(['/ssh-config']);
        }
      }
    });
  }
}
