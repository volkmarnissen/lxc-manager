//

import { ISsh } from '../shared/types';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IApplicationWeb, IParameter } from '../shared/types';



export type ProxmoxConfigParam = { name: string; value: string | number | boolean };


@Injectable({
  providedIn: 'root',
})
export class ProxmoxConfigurationService {
  constructor(private http: HttpClient, private router: Router) {}

  private static _router: Router;
  static setRouter(router: Router) {
    ProxmoxConfigurationService._router = router;
  }
  static handleError(err: any) {
    let msg = '';
    if (err?.error?.errors && Array.isArray(err.error.errors) && err.error.errors.length > 0) {
      msg = err.error.errors.join('\n');
    } else if (err?.error?.error) {
      msg = err.error.error;
    } else if (err?.message) {
      msg = err.message;
    } else if (err?.status) {
      msg = `Http Error status code: ${err.status}`;
    } else {
      msg = 'Unknown error';
    }
    alert(msg);
    if (ProxmoxConfigurationService._router) {
      ProxmoxConfigurationService._router.navigate(['/']);
    }
    return throwError(() => err);
  }

  getApplications(): Observable<IApplicationWeb[]> {
    ProxmoxConfigurationService.setRouter(this.router);
    return this.http.get<IApplicationWeb[]>('/api/applications').pipe(
      catchError(ProxmoxConfigurationService.handleError)
    );
  }
  getUnresolvedParameters(application: string, task: string): Observable<{ unresolvedParameters: IParameter[] }> {
    ProxmoxConfigurationService.setRouter(this.router);
    return this.http.get<{ unresolvedParameters: IParameter[] }>(`/api/getUnresolvedParameters/${application}/${task}`).pipe(
      catchError(ProxmoxConfigurationService.handleError)
    );
  }
  getSshConfig() {
    return this.http.get<ISsh>('/api/sshconfig').pipe(
      catchError(ProxmoxConfigurationService.handleError)
    );
  }

  postProxmoxConfiguration(application: string, task: string, params: ProxmoxConfigParam[]): Observable<{ success: boolean }> {
    const url = `/api/proxmox-configuration/${encodeURIComponent(application)}/${encodeURIComponent(task)}`;
    return this.http.post<{ success: boolean }>(url, params).pipe(
      catchError(ProxmoxConfigurationService.handleError)
    );
  }

  setSshConfig(ssh: ISsh) {
    return this.http.post<{ success: boolean }>('/api/sshconfig', ssh).pipe(
      catchError(ProxmoxConfigurationService.handleError)
    );
  }
}
