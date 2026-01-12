import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { IJsonError } from '../../shared/types';

@Component({
  selector: 'app-error-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  template: `
    <div class="error-dialog-container">
      <button type="button" class="close-errors-btn" (click)="dialogRef.close()" aria-label="Close error list">&times;</button>
      <ul class="error-list-ul">
        @for (err of data.errors; track $index) {
          <ng-container *ngTemplateOutlet="errorTemplate; context: { $implicit: err }"></ng-container>
        }
      </ul>
    </div>
    <ng-template #errorTemplate let-err>
      <li>
        @if (err?.name) {
          <span class="error-name">{{ err.name }}: </span>
        }
        {{ err?.message || '' }}
        @if (err?.line !== undefined && err?.line !== null) {
          <span class="error-line"> (line {{ err.line }})</span>
        }
        @if (hasDetails(err)) {
          <ul>
            @for (child of err!.details!; track $index) {
              <ng-container *ngTemplateOutlet="errorTemplate; context: { $implicit: child }"></ng-container>
            }
          </ul>
        }
      </li>
    </ng-template>
  `,
  styles: [
    `.error-dialog-container{position:relative;padding:0}`,
    `.error-list-ul{background:#fff0f0;color:#c00;border:1.5px solid #e53935;border-radius:8px;padding:2em 2.5em;font-size:1.1em;min-width:420px;max-width:90vw;max-height:70vh;overflow:auto;box-shadow:0 4px 32px rgba(229,57,53,0.18)}`,
    `.error-list-ul ul{margin:0.25em 0 0 1.2em;padding:0}`,
    `.error-list-ul li{margin-bottom:0.25em;white-space:normal;word-break:break-word;overflow-wrap:anywhere}`,
    `.error-name{font-weight:600;color:#a00}`,
    `.error-line{color:#800;font-size:0.9em}`,
    `.close-errors-btn{position:absolute;top:0.6em;right:0.8em;background:#fff0f0;border:1.5px solid #e53935;border-radius:50%;font-size:1.4em;color:#c00;cursor:pointer;width:2.2em;height:2.2em;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(229,57,53,0.10);transition:background 0.2s;opacity:0.8}`,
    `.close-errors-btn:hover{opacity:1;background:#ffe0e0;color:#a00;border-color:#c00}`,
    // Remove default Material dialog padding/background to avoid white bands
    `:host{display:block}`,
    `:host ::ng-deep .error-dialog-panel{margin:0;padding:0;background:transparent;box-shadow:none;border:none}`,
    `:host ::ng-deep .error-dialog-panel .mat-dialog-container{margin:0;padding:0;background:transparent;box-shadow:none;border:none}`,
    `:host ::ng-deep .error-dialog-panel .mat-dialog-content{padding:0;margin:0}`,
    `:host ::ng-deep .error-dialog-panel .cdk-overlay-pane{margin:0}`,
  ]
})
export class ErrorDialog {
  dialogRef = inject(MatDialogRef<ErrorDialog>);
  data = inject<{ errors: IJsonError[] }>(MAT_DIALOG_DATA);

  hasDetails(err: IJsonError | undefined): boolean {
    return !!(err?.details && Array.isArray(err.details) && err.details.length > 0);
  }
}
