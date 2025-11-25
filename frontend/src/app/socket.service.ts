import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket;

  constructor() {
    console.log('SocketService constructed')
    this.socket = io('http://localhost:3000'); // Default: same host/port as Angular app
  }

  onMessage<T = any>(): Observable<T> {
    return new Observable<T>(observer => {
      this.socket.on('message', (data: T) => {
        observer.next(data);
      });
      return () => this.socket.off('message');
    });
  }

  // Optional: send message to server
  sendMessage<T = any>(data: T) {
    this.socket.emit('message', data);
  }
}
