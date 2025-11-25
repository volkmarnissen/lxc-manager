
import { Routes } from '@angular/router';
import { Home } from './home/home';
import { ApplicationsList } from './applications-list/applications-list';
import { ProcessMonitor } from './process-monitor/process-monitor';

export const routes: Routes = [
	{ path: '', component: ApplicationsList },
	{ path: 'home', component: Home },
	{ path: 'monitor', component: ProcessMonitor },
];
