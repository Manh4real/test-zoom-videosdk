import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CameraComponent } from './components/camera/camera.component';
import { ParticipantsComponent } from './components/participants/participants.component';
import { ZoomVideoService } from './services/zoom-video.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CameraComponent, ParticipantsComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly zoomVideoService = inject(ZoomVideoService);

  get videoIsOff(): boolean {
    return this.zoomVideoService.offVideo$.getValue();
  }
  get micIsOff(): boolean | null {
    return this.zoomVideoService.offMic$.getValue();
  }
  get sharescreenIsOff(): boolean {
    return this.zoomVideoService.offSharescreen$.getValue();
  }

  constructor() {}

  ngOnDestroy(): void {
    this.zoomVideoService.client?.leave();
    // ZoomVideo.destroyClient();
  }

  ngOnInit(): void {
    this.zoomVideoService.initClient();
  }

  title = 'angular-zoom-videosdk';

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
  onToggleSharescreenClick(): void {
    this.zoomVideoService.offSharescreen$.next(
      !this.zoomVideoService.offSharescreen$.getValue()
    );
  }
}
