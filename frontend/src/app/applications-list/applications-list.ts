
import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ProxmoxConfigurationDialog } from '../proxmox-configuration-dialog/proxmox-configuration-dialog';
import { CommonModule } from '@angular/common';
import { ProxmoxConfigurationService } from '../proxmox-configuration.service';
import { IApplicationWeb } from '../../shared/types';

@Component({
  selector: 'app-applications-list',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './applications-list.html',
  styleUrl: './applications-list.scss',
})
export class ApplicationsList implements OnInit {
  applications: IApplicationWeb[] = [];
  loading = true;
  error?: string;

  constructor(private proxmoxService: ProxmoxConfigurationService, private dialog: MatDialog) {}

  openProxmoxConfigDialog(app: IApplicationWeb) {
    this.dialog.open(ProxmoxConfigurationDialog, {
      data: { app },
    });
  }

  ngOnInit(): void {
    this.proxmoxService.getApplications().subscribe({
      next: (apps) => {
        this.applications = apps;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error loading applications';
        this.loading = false;
      }
    });
  }
}
