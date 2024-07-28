import { Injectable } from '@angular/core';
import ZoomVideo, {
  ParticipantPropertiesPayload,
  Stream,
  VideoClient,
  VideoPlayer,
} from '@zoom/videosdk';
import { BehaviorSubject } from 'rxjs';

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
  offSharescreen$ = new BehaviorSubject<boolean>(true);

  readonly zoomInfo = {
    role: 1,
    sessionName: 'testZoom123',
    userIdentity: 'Manh Nguyen' + Math.floor(Date.now()),
  };

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

    this.client?.changeName('Manh - ' + this.zoomInfo.userIdentity);

    this.mediaStream$.next(this.client!.getMediaStream());
  }

  createParticipantElement(
    video: VideoPlayer,
    user: ParticipantPropertiesPayload
  ): HTMLElement {
    const div = document.createElement('div');
    div.className = 'flex flex-col gap-2';

    const button = document.createElement('button');
    button.textContent = 'Remove';
    button.className =
      'focus:outline-none text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5';
    button.onclick = () => {
      this.client?.removeUser(user.userId).then(() => {});
    };

    video.setAttribute('data-display-name', user.displayName || '');

    div.appendChild(video);
    div.appendChild(button);

    return div;
  }

  createNotifElement(list: ParticipantPropertiesPayload[]): HTMLElement {
    const div = document.createElement('div');
    div.className =
      'flex gap-2 py-2 px-4 rounded font-medium bg-red-700 text-white';
    div.textContent =
      list.map((user) => user.userIdentity || user.userId).join(', ') +
      (list.length <= 1 ? ' has' : ' have') +
      ' left the call';

    setTimeout(() => div.remove(), 5000);

    return div;
  }

  createSharescreenVideo() {
    // For share screen owner

    const userId = this.client?.getCurrentUserInfo().userId;

    const video = document.createElement('video');
    video.className = 'sharescreen-video | mt-4 border-4 border-green-400';
    video.setAttribute('data-sharecreen-userid', String(userId));

    return video;
  }

  createSharescreenCanvas(userId: string) {
    // For share screen viewer

    const canvas = document.createElement('canvas');
    canvas.className = 'sharescreen-canvas | mt-4 border-4 border-green-400';
    canvas.setAttribute('data-sharecreen-userid', userId);

    return canvas;
  }

  createSharescreenContainer(
    sharescreenVideo: HTMLElement,
    userId: number
  ): HTMLElement {
    const div = document.createElement('div');
    div.className = 'relative';

    const p = document.createElement('p');

    const currentUserId = this.client?.getCurrentUserInfo().userId;

    // May replace with username
    p.textContent = `${
      userId === currentUserId ? 'You are' : `${userId} is`
    } sharing`;
    p.className =
      'absolute bottom-0 left-0 bg-gray-900 opacity-80 font-medium text-white py-2 px-4';

    div.appendChild(sharescreenVideo);
    div.appendChild(p);

    return div;
  }
}
