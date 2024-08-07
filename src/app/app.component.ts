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
import { combineLatestWith, skip, take } from 'rxjs';
import { CommonModule } from '@angular/common';
import ZoomVideo, {
  ConnectionState,
  ShareStatus,
  Stream,
} from '@zoom/videosdk';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, CameraComponent, ParticipantsComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent implements OnInit, OnDestroy {
  protected readonly zoomVideoService = inject(ZoomVideoService);

  @ViewChild('sharescreenContainer')
  sharescreenContainerElement?: ElementRef<HTMLVideoElement>;

  connectionState?: ConnectionState;
  get isRemoved(): boolean {
    return this.connectionState === ConnectionState.Closed;
  }

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

  async ngOnDestroy(): Promise<void> {
    if (!this.zoomVideoService.client) return;

    await this.zoomVideoService.client.leave();

    if (this.zoomVideoService.client.getAllUser().length === 0) {
      ZoomVideo.destroyClient();
    }
  }

  ngOnInit(): void {
    this.zoomVideoService.initClient();

    this.zoomVideoService.client$
      .pipe(combineLatestWith(this.zoomVideoService.mediaStream$))
      .subscribe(([client, mediaStream]) => {
        if (!client) return;

        client.on('share-content-change', async (payload) => {
          console.log('share-content-change', payload);
        });

        client.on('active-share-change', async (payload) => {
          console.log('active-share-change', payload, Boolean(mediaStream));

          const renderSharescreenView = async (mediaStream: typeof Stream) => {
            if (payload.state === 'Active') {
              this.sharescreenContainerElement?.nativeElement.replaceChildren();

              const sharescreenVideo =
                this.zoomVideoService.createSharescreenCanvas(
                  String(payload.userId)
                );

              await mediaStream.startShareView(
                sharescreenVideo,
                payload.userId
              );

              const container =
                this.zoomVideoService.createSharescreenContainer(
                  sharescreenVideo,
                  payload.userId
                );

              this.sharescreenContainerElement?.nativeElement.appendChild(
                container
              );
            } else {
              await mediaStream.stopShareView();
              this.sharescreenContainerElement?.nativeElement.replaceChildren();
            }
          };

          if (!mediaStream) {
            // In case 'active-share-change' event handler run before media stream is initialized
            const tempSubscriber = this.zoomVideoService.mediaStream$
              .asObservable()
              .pipe(skip(1))
              .subscribe(async (mediaStream) => {
                console.log(
                  "In case 'active-share-change' event handler run before media stream is initialized"
                );
                if (!mediaStream) return;

                renderSharescreenView(mediaStream);
                tempSubscriber.unsubscribe();
              });

            return;
          }

          renderSharescreenView(mediaStream);
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

        client.on('connection-change', (payload) => {
          this.connectionState = payload.state;

          if (this.connectionState === ConnectionState.Closed) {
            // Remove all values used by zoom videoSDK
            localStorage.clear();
          }
        });
      });
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
        const userId =
          this.zoomVideoService.client?.getCurrentUserInfo().userId;
        const sharescreenVideo = this.zoomVideoService.createSharescreenVideo();
        const sharescreenContainer =
          this.zoomVideoService.createSharescreenContainer(
            sharescreenVideo,
            userId || 0
          );

        this.sharescreenContainerElement?.nativeElement.appendChild(
          sharescreenContainer
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

  async onLeaveCall(): Promise<void> {
    this.zoomVideoService.client?.leave();
  }

  async onEndCall(): Promise<void> {
    await this.zoomVideoService.client?.leave(true);
    ZoomVideo.destroyClient();
  }

  onRefreshClick(): void {
    window.location.reload();
  }
}
