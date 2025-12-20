import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface StderrDialogData {
  command: string;
  stderr: string;
  exitCode?: number;
}

@Component({
  selector: 'app-stderr-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>Command Output</h2>
    <mat-dialog-content>
      <div class="command-info">
        <strong>Command:</strong> {{ data.command }}
      </div>
      @if (data.exitCode !== undefined) {
        <div class="command-info">
          <strong>Exit Code:</strong> {{ data.exitCode }}
        </div>
      }
      <div class="stderr-content">
        <strong>stderr Output:</strong>
        <pre>{{ data.stderr }}</pre>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="close()">Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .command-info {
      margin-bottom: 1rem;
      padding: 0.5rem;
      background: #f5f5f5;
      border-radius: 4px;
    }
    .command-info strong {
      margin-right: 0.5rem;
      color: #666;
    }
    .stderr-content {
      margin-top: 1rem;
    }
    .stderr-content strong {
      display: block;
      margin-bottom: 0.5rem;
      color: #666;
    }
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 0.9rem;
      line-height: 1.5;
      max-height: 60vh;
      overflow-y: auto;
    }
    mat-dialog-content {
      min-width: 500px;
      max-width: 90vw;
    }
  `]
})
export class StderrDialogComponent {
  public data = inject<StderrDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<StderrDialogComponent>);

  close(): void {
    this.dialogRef.close();
  }
}
