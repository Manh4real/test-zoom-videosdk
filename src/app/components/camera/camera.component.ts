import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { ZoomVideoService } from '../../services/zoom-video.service';
import { VideoPlayer, VideoQuality } from '@zoom/videosdk';
import { combineLatest, combineLatestWith, skip } from 'rxjs';

@Component({
  selector: 'app-camera',
  standalone: true,
  imports: [],
  templateUrl: './camera.component.html',
  styleUrl: './camera.component.scss',
  providers: [Document],
})
export class CameraComponent implements OnInit {
  private zoomVideoService = inject(ZoomVideoService);

  @ViewChild('camera') cameraElement?: ElementRef<HTMLVideoElement>;
  cameraStatus: 'idle' | 'starting' | 'started' | 'disabled' = 'idle';

  ngOnInit(): void {
    this.zoomVideoService.mediaStream$.subscribe(async (mediaStream) => {
      if (!mediaStream) return;
      // await mediaStream.startVideo({
      //   videoElement: document.getElementById('camera-video') as any,
      //   captureWidth: 320,
      //   captureHeight: 180,
      // });
      await mediaStream.startAudio();

      this.zoomVideoService.offMic$.next(true);
      this.zoomVideoService.offVideo$.next(false);

      // mediaStream.renderVideo(
      //   document.getElementById('camera-canvas') as any,
      //   this.zoomVideoService.client.getCurrentUserInfo().userId,
      //   320,
      //   180,
      //   0,
      //   0,
      //   VideoQuality.Video_720P
      // );
    });

    this.zoomVideoService.offVideo$
      .pipe(combineLatestWith(this.zoomVideoService.mediaStream$))
      .subscribe(async ([videoIsOff, mediaStream]) => {
        if (!mediaStream) return;

        if (videoIsOff) {
          await mediaStream.stopVideo();

          this.cameraStatus = 'disabled';
          // mediaStream.detachVideo(
          //   this.zoomVideoService.client?.getCurrentUserInfo().userId || 0
          // );
        } else {
          // const currentUserInfo = client.getCurrentUserInfo()
          if (!this.cameraElement) return;
          const videoElement = this.cameraElement.nativeElement;

          if (
            this.cameraStatus === 'starting' ||
            this.cameraStatus === 'started'
          )
            return;

          this.cameraStatus = 'starting';
          await mediaStream.startVideo({
            videoElement: videoElement,
          });
          this.cameraStatus = 'started';

          videoElement?.setAttribute(
            'node-id',
            String(this.zoomVideoService.client?.getCurrentUserInfo().userId)
          );
        }
      });

    this.zoomVideoService.offMic$
      .pipe(combineLatestWith(this.zoomVideoService.mediaStream$))
      .subscribe(async ([micIsOff, mediaStream]) => {
        if (!mediaStream) return;

        if (micIsOff === true) {
          await mediaStream.muteAudio();
        } else if (micIsOff === false) {
          await mediaStream.unmuteAudio();
        }
      });
  }
}
