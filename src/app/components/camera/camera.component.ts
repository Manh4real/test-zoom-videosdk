import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatestWith } from 'rxjs';

import { ZoomVideoService } from '../../services/zoom-video.service';

@Component({
  selector: 'app-camera',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './camera.component.html',
  styleUrl: './camera.component.scss',
  providers: [Document],
})
export class CameraComponent implements OnInit {
  protected zoomVideoService = inject(ZoomVideoService);

  @ViewChild('camera') cameraElement?: ElementRef<HTMLVideoElement>;
  cameraStatus: 'idle' | 'starting' | 'started' | 'disabled' = 'idle';

  ngOnInit(): void {
    this.zoomVideoService.mediaStream$.subscribe(async (mediaStream) => {
      if (!mediaStream) return;

      await mediaStream.startAudio({
        autoStartAudioInSafari: true,
        backgroundNoiseSuppression: true,
      });

      this.zoomVideoService.offMic$.next(true);
      this.zoomVideoService.offVideo$.next(false);
    });

    this.zoomVideoService.offVideo$
      .pipe(combineLatestWith(this.zoomVideoService.mediaStream$))
      .subscribe(async ([videoIsOff, mediaStream]) => {
        if (!mediaStream) return;

        if (videoIsOff) {
          await mediaStream.stopVideo();

          this.cameraStatus = 'disabled';
        } else {
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

          videoElement?.setAttribute(
            'data-display-name',
            String(
              this.zoomVideoService.client?.getCurrentUserInfo().displayName
            )
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
