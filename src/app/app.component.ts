import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CameraComponent } from './components/camera/camera.component';
import { ParticipantsComponent } from './components/participants/participants.component';
import { ZoomVideoService } from './services/zoom-video.service';
import { combineLatestWith, skip } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ShareStatus, VideoQuality } from '@zoom/videosdk';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, CameraComponent, ParticipantsComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly zoomVideoService = inject(ZoomVideoService);

  @ViewChild('sharescreenContainer')
  sharescreenContainerElement?: ElementRef<HTMLVideoElement>;

  get videoIsOff(): boolean {
    return this.zoomVideoService.offVideo$.getValue();
  }
  get micIsOff(): boolean | null {
    return this.zoomVideoService.offMic$.getValue();
  }
  get sharescreenIsOff(): boolean {
    return this.zoomVideoService.offSharescreen$.getValue();
  }

  get isSharingScreen(): boolean {
    return (
      this.zoomVideoService.mediaStream$.getValue()?.getShareStatus() ===
      ShareStatus.Sharing
    );
  }

  constructor() {}

  ngOnDestroy(): void {
    this.zoomVideoService.client?.leave();
    // ZoomVideo.destroyClient();
  }

  ngOnInit(): void {
    this.zoomVideoService.initClient();

    this.zoomVideoService.client$
      .pipe(combineLatestWith(this.zoomVideoService.mediaStream$))
      .subscribe(([client, mediaStream]) => {
        if (!client) return;

        client.on('share-content-change', async (payload) => {
          console.log('share-content-change', payload);

          // if (!mediaStream) return;

          // const sharescreenVideo = await mediaStream.attachVideo(
          //   payload.userId,
          //   VideoQuality.Video_720P
          // );

          // this.sharescreenContainerElement?.nativeElement.appendChild(
          //   sharescreenVideo as HTMLElement
          // );
        });

        client.on('active-share-change', async (payload) => {
          console.log('active-share-change', payload);

          if (!mediaStream) return;

          if (payload.state === 'Active') {
            this.sharescreenContainerElement?.nativeElement.replaceChildren();

            const sharescreenVideo = this.createSharescreenCanvas(
              String(payload.userId)
            );

            await mediaStream.startShareView(sharescreenVideo, payload.userId);

            this.sharescreenContainerElement?.nativeElement.appendChild(
              sharescreenVideo as HTMLElement
            );
          } else {
            await mediaStream.stopShareView();
            this.sharescreenContainerElement?.nativeElement.replaceChildren();
          }
        });

        client.on('share-can-see-screen', (payload: any) => {
          console.log('share-can-see-screen', payload);
        });

        // To update sharescreen video displaying
        client.on('user-updated', (payload) => {
          payload.forEach((user) => {
            if (user.sharerOn === false) {
              this.sharescreenContainerElement?.nativeElement.replaceChildren();
              this.zoomVideoService.offSharescreen$.next(true);
            }
          });
        });
      });
  }

  title = 'angular-zoom-videosdk';

  createSharescreenVideo(userId: string) {
    const video = document.createElement('video');
    video.className = 'sharescreen-video | mt-4 border-4 border-green-400';
    video.setAttribute('data-sharecreen-userid', userId);

    return video;
  }

  createSharescreenCanvas(userId: string) {
    const canvas = document.createElement('canvas');
    canvas.className = 'sharescreen-canvas | mt-4 border-4 border-green-400';
    canvas.setAttribute('data-sharecreen-userid', userId);

    return canvas;
  }

  onToggleVideoClick(): void {
    this.zoomVideoService.offVideo$.next(
      !this.zoomVideoService.offVideo$.getValue()
    );
  }
  onToggleMicClick(): void {
    this.zoomVideoService.offMic$.next(
      !this.zoomVideoService.offMic$.getValue()
    );
  }
  async onToggleSharescreenClick(): Promise<void> {
    let flag = !this.zoomVideoService.offSharescreen$.getValue();

    const mediaStream = this.zoomVideoService.mediaStream$.getValue();

    if (!mediaStream) return;

    if (flag === true) {
      if (mediaStream.getShareStatus() === ShareStatus.Sharing) {
        await mediaStream.stopShareScreen();
      }
    } else if (flag === false) {
      if (!this.sharescreenContainerElement) return;

      // Business logic
      if (mediaStream.getShareStatus() === ShareStatus.Sharing) {
        await mediaStream.stopShareScreen();
        return;
      }

      if (mediaStream.isShareLocked()) {
        await mediaStream.stopShareScreen();
        return;
      }

      try {
        const sharescreenVideo = this.createSharescreenVideo(
          String(this.zoomVideoService.client?.getCurrentUserInfo().userId)
        );
        this.sharescreenContainerElement.nativeElement.appendChild(
          sharescreenVideo
        );

        await mediaStream.startShareScreen(sharescreenVideo, {
          controls: {},
        });

        // await mediaStream.lockShare(true);
        flag = false;
      } catch (err) {
        this.sharescreenContainerElement.nativeElement.replaceChildren();
        flag = true;
      }

      this.zoomVideoService.offSharescreen$.next(flag);
    }
  }
}
