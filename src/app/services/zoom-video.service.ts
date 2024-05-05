import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import ZoomVideo, { Stream, VideoClient } from '@zoom/videosdk';
import { BehaviorSubject, lastValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ZoomVideoService {
  private _client$ = new BehaviorSubject<typeof VideoClient | null>(null);
  client$ = this._client$.asObservable();
  get client() {
    return this._client$.getValue();
  }

  mediaStream$ = new BehaviorSubject<typeof Stream | null>(null);

  offVideo$ = new BehaviorSubject<boolean>(false);
  offMic$ = new BehaviorSubject<boolean | null>(null);
  offSharescreen$ = new BehaviorSubject<boolean>(false);

  readonly zoomInfo = {
    role: 1,
    sessionName: 'testZoom123',
    userIdentity: 'Manh Nguyen' + Math.floor(Date.now()),
    // sessionKey: 'testZoom123testZoom123',
  };

  private readonly httpClient = inject(HttpClient);

  constructor() {}

  async initClient() {
    const res = await fetch('http://localhost:4000/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.zoomInfo),
    });
    const response = await res.json();

    const token = response.signature;
    const client = ZoomVideo.createClient();

    await client.init('en-US', 'Global', {
      patchJsMedia: true,
      stayAwake: true,
      enforceMultipleVideos: true,
    });

    this._client$.next(client);

    await this.client!.join(
      this.zoomInfo.sessionName,
      token,
      this.zoomInfo.userIdentity
    );

    this.mediaStream$.next(this.client!.getMediaStream());
  }
}
