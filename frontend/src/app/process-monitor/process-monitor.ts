import { NgZone, OnDestroy, Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { IVeExecuteMessagesResponse, ISingleExecuteMessagesResponse } from '../../shared/types';
import { VeConfigurationService } from '../ve-configuration.service';
import { StderrDialogComponent } from './stderr-dialog.component';

@Component({
  selector: 'app-process-monitor',
  standalone: true,
  imports: [CommonModule, MatExpansionModule, MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './process-monitor.html',
  styleUrl: './process-monitor.scss',
})
export class ProcessMonitor implements OnInit, OnDestroy {
  messages: IVeExecuteMessagesResponse| undefined;
  private pollInterval?: number;
  private veConfigurationService = inject(VeConfigurationService);
  private router = inject(Router);
  private zone = inject(NgZone);
  private dialog = inject(MatDialog);

  ngOnInit() {
    this.startPolling();
  }

  ngOnDestroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  startPolling() {
    this.pollInterval = setInterval(() => {
      this.veConfigurationService.getExecuteMessages().subscribe({
        next: (msgs) => {
          if (msgs && msgs.length > 0) {
            this.zone.run(() => {
              this.mergeMessages(msgs);
              this.checkAllFinished();
            });
          }
        },
        error: () => {
          // Optionally handle error
        }
      });
    }, 5000);
  }

  private checkAllFinished() {
    // No longer auto-navigate - user can view logs and navigate manually
  }

  private mergeMessages(newMsgs: IVeExecuteMessagesResponse) {
    if (!this.messages) {
      this.messages = [...newMsgs];
      return;
    }
    
    for (const newGroup of newMsgs) {
      const existing = this.messages.find(
        g => g.application === newGroup.application && g.task === newGroup.task
      );
      if (existing) {
        // Append only new messages (by index)
        const existingIndices = new Set(existing.messages.map(m => m.index));
        for (const msg of newGroup.messages) {
          if (!existingIndices.has(msg.index)) {
            existing.messages.push(msg);
          }
        }
      } else {
        // Add new application/task group
        this.messages.push({ ...newGroup });
      }
    }
  }

  hasError(group: ISingleExecuteMessagesResponse): boolean {
    const hasFinished = group.messages.some(msg => msg.finished);
    if (hasFinished) return false;
    return group.messages.some(msg => msg.error || (msg.exitCode !== undefined && msg.exitCode !== 0));
  }

  triggerRestart(group: ISingleExecuteMessagesResponse) {
    if (!group.restartKey) return;
    
    this.veConfigurationService.restartExecution(group.restartKey).subscribe({
      next: () => {
        // Clear old messages for this group to show fresh run
        if (this.messages) {
          const idx = this.messages.findIndex(
            g => g.application === group.application && g.task === group.task
          );
          if (idx >= 0) {
            this.messages.splice(idx, 1);
          }
        }
      },
      error: (err) => {
        console.error('Restart failed:', err);
      }
    });
  }

  openStderrDialog(msg: any): void {
    if (!msg.stderr) return;
    
    this.dialog.open(StderrDialogComponent, {
      width: '700px',
      maxWidth: '90vw',
      data: {
        command: msg.command || msg.commandtext || 'Unknown command',
        stderr: msg.stderr,
        exitCode: msg.exitCode
      }
    });
  }

}