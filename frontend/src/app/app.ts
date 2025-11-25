import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfigurationDialog } from './configuration-dialog/configuration-dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConfigurationDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('webapp-angular');
  showSshDialog = false;

  openSshDialog() {
    this.showSshDialog = true;
  }
  closeSshDialog() {
    this.showSshDialog = false;
  }
}
