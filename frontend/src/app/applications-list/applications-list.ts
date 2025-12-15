
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { ProxmoxConfigurationService } from '../ve-configuration.service';
import { IApplicationWeb } from '../../shared/types';

interface IApplicationWebIntern extends IApplicationWeb{
  showErrors?: boolean;
}
@Component({
  selector: 'app-applications-list',
  standalone: true,
    imports: [CommonModule, MatDialogModule],
  templateUrl: './applications-list.html',
  styleUrl: './applications-list.scss',
})

export class ApplicationsList implements OnInit {
  applications: IApplicationWebIntern[] = [];
  loading = true;
  error?: string;
  private proxmoxService = inject(ProxmoxConfigurationService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  openProxmoxConfigDialog(_app: IApplicationWeb) {
    this.router.navigateByUrl('/ssh-config');
  }
  showErrors(_app: IApplicationWebIntern) {
    // Non-modal mode: optionally navigate to a dedicated errors page or inline panel.
    // Currently a no-op to remove MatDialog usage.
  }

  ngOnInit(): void {
    this.proxmoxService.getApplications().subscribe({
      next: (apps) => {
        this.applications = apps.map((app) => ({ ...app, showErrors: false }));
        this.loading = false;
      },
      error: () => {
        this.error = 'Error loading applications';
        this.loading = false;
      }
    });
  }
}
