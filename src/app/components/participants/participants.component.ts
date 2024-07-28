import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { combineLatestWith, skip } from 'rxjs';
import {
  ParticipantPropertiesPayload,
  VideoPlayer,
  VideoPlayerContainer,
  VideoQuality,
} from '@zoom/videosdk';

import { ZoomVideoService } from '../../services/zoom-video.service';

@Component({
  selector: 'app-participants',
  standalone: true,
  imports: [],
  templateUrl: './participants.component.html',
  styleUrl: './participants.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [Document],
})
export class ParticipantsComponent implements OnInit {
  private readonly zoomVideoService = inject(ZoomVideoService);

  @ViewChild('list') listElement?: ElementRef<VideoPlayerContainer>;
  @ViewChild('notifContainer')
  notifContainerElement?: ElementRef<HTMLDivElement>;
  STOPPED_MEDIA_NODE_ID = '0';

  queryVideoElement(nodeId: string) {
    return document.querySelector(`[node-id='${nodeId}']`)?.parentElement;
  }

  ngOnInit(): void {
    this.zoomVideoService.client$
      .pipe(
        skip(1),
        combineLatestWith(this.zoomVideoService.mediaStream$.pipe(skip(1)))
      )
      .subscribe(([_client, _mediaStream]) => {
        const client = _client!;
        const mediaStream = _mediaStream!;

        console.log(client.getAllUser());

        client.on('peer-video-state-change', async (data) => {
          console.log('peer-video-state-change', data);

          if (data.action === 'Start') {
            const user = _client
              ?.getAllUser()
              .find((u) => u.userId === data.userId);

            if (!user) return;

            const videoPlayer = await mediaStream.attachVideo(
              data.userId,
              VideoQuality.Video_90P
            );

            this.appendToParticipantList(videoPlayer as VideoPlayer, user);
          } else {
            const videoPlayer = await mediaStream.detachVideo(data.userId);
            this.queryVideoElement(this.STOPPED_MEDIA_NODE_ID)?.remove();
          }
        });

        client.getAllUser().forEach((user) => {
          if (user.userId === client.getCurrentUserInfo().userId) return;

          if (user.bVideoOn) {
            mediaStream
              .attachVideo(user.userId, VideoQuality.Video_1080P)
              .then((userVideo) => {
                this.appendToParticipantList(userVideo as VideoPlayer, user);
              });
          }
        });

        client.on('user-added', async (payload) => {
          // user joined
          console.log('user-added', payload);
          const results = await Promise.allSettled(
            payload.map(async (p) => {
              if (this.queryVideoElement(String(p.userId))) {
                await mediaStream.detachVideo(p.userId);
                this.queryVideoElement(String(p.userId))?.remove();
              }

              const userVideo = await mediaStream.attachVideo(
                p.userId,
                VideoQuality.Video_90P
              );

              (userVideo as VideoPlayer).setAttribute(
                'data-participant',
                String(p.userId)
              );
              return { userVideo, userId: p.userId, user: p };
            })
          );

          results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value) {
              const video = result.value.userVideo as VideoPlayer;

              this.appendToParticipantList(video, result.value.user);
            }
          });
        });

        client.on('user-removed', (payload) => {
          console.log('user-removed', payload);
          // user left
          payload.forEach((p) => {
            mediaStream.detachVideo(p.userId).then((userVideo) => {
              this.queryVideoElement(this.STOPPED_MEDIA_NODE_ID)?.remove();
            });
          });

          this.showUserLeftNotif(payload);
        });

        client.on('connection-change', (payload) => {
          console.log('connection-change', payload);
          // session ended by host
        });

        client.on('user-updated', (data) => {
          console.log('user-updated', data);
        });
      });
  }

  appendToParticipantList(
    video: VideoPlayer,
    user: ParticipantPropertiesPayload
  ): void {
    const div = this.zoomVideoService.createParticipantElement(video, user);

    this.listElement?.nativeElement.appendChild(div);
  }

  showUserLeftNotif(list: ParticipantPropertiesPayload[]) {
    const div = this.zoomVideoService.createNotifElement(list);

    setTimeout(() => div.remove(), 5000);
  }
}
