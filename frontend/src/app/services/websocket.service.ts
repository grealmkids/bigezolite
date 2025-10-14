
import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket$: WebSocketSubject<any>;

  constructor() {
    this.socket$ = webSocket(environment.wsUrl);
  }

  public getMessages() {
    return this.socket$.asObservable();
  }

  public sendMessage(message: any) {
    this.socket$.next(message);
  }
}
