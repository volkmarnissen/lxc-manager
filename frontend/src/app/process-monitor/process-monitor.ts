import { NgZone, OnDestroy, Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { IVeExecuteMessagesResponse, ISingleExecuteMessagesResponse, IParameterValue, IVeExecuteMessage } from '../../shared/types';
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
  private route = inject(ActivatedRoute);
  private zone = inject(NgZone);
  private dialog = inject(MatDialog);
  private storedParams: Record<string, { name: string; value: IParameterValue }[]> = {};

  ngOnInit() {
    // Get original parameters from navigation state
    // Try getCurrentNavigation first (during navigation), then history.state (after navigation)
    const navigation = this.router.getCurrentNavigation();
    const state = (navigation?.extras?.state || history.state) as { originalParams?: { name: string; value: IParameterValue }[], restartKey?: string } | null;
    if (state?.originalParams && state.restartKey) {
      this.storedParams[state.restartKey] = state.originalParams;
    }
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

  triggerRestartFull(group: ISingleExecuteMessagesResponse) {
    if (!group.restartKey) return;
    
    // Get original parameters from stored state or navigation
    const originalParams = this.storedParams[group.restartKey];
    if (!originalParams) {
      console.error('Original parameters not found for restart key:', group.restartKey);
      alert('Original parameters not found. Please start installation again.');
      return;
    }
    
    this.veConfigurationService.restartExecutionFull(group, originalParams).subscribe({
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
        console.error('Full restart failed:', err);
      }
    });
  }

  openStderrDialog(msg: IVeExecuteMessage): void {
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