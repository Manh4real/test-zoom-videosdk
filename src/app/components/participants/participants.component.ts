import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { ZoomVideoService } from '../../services/zoom-video.service';
import { combineLatestWith, skip } from 'rxjs';
import ZoomVideo, {
  VideoPlayer,
  VideoPlayerContainer,
  VideoQuality,
} from '@zoom/videosdk';

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

  queryVideoElement(nodeId: string) {
    return document.querySelector(`[node-id='${nodeId}']`);
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
            const videoPlayer = await mediaStream.attachVideo(
              data.userId,
              VideoQuality.Video_90P
            );

            this.listElement?.nativeElement.appendChild(
              videoPlayer as HTMLElement
            );
          } else {
            const videoPlayer = await mediaStream.detachVideo(data.userId);

            this.queryVideoElement('0')?.remove();
          }
        });

        // reset video elements before rerendering
        // this.listElement?.nativeElement.replaceChildren();

        client.getAllUser().forEach((user) => {
          if (user.userId === client.getCurrentUserInfo().userId) return;

          if (user.bVideoOn) {
            mediaStream
              .attachVideo(user.userId, VideoQuality.Video_1080P)
              .then((userVideo) => {
                this.listElement?.nativeElement.appendChild(
                  userVideo as HTMLElement
                );
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
              return userVideo;
            })
          );

          results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value) {
              const video = result.value as VideoPlayer;

              video.classList.add('bg-gray-100', 'rounded-sm');

              this.listElement?.nativeElement.appendChild(video as HTMLElement);
            }
          });
        });

        client.on('user-removed', (payload) => {
          console.log('user-removed', payload);
          // user left
          payload.forEach((p) => {
            mediaStream.detachVideo(p.userId).then((userVideo) => {
              this.queryVideoElement('0')?.remove();
            });
          });
        });

        client.on('connection-change', (payload) => {
          console.log('connection-change', payload);
          // session ended by host
        });

        client.on('user-updated', (data) => {
          console.log('user-updated', data);
          // this.listElement?.nativeElement.replaceChildren();

          // Promise.allSettled(
          //   data.map(async (p) => {
          //     if (p.userId === client.getCurrentUserInfo().userId) return null;
          //     // if (!p.bVideoOn) return;

          //     // mediaStream.detachVideo(p.userId);

          //     try {
          //       const videoElement = await mediaStream.attachVideo(
          //         p.userId,
          //         VideoQuality.Video_1080P
          //       );

          //       return videoElement;

          //       // // const video = document.createElement('canvas');
          //       // const video = document.createElement('video');

          //       // video.width = 16 * 1.5 * 10;
          //       // video.height = 9 * 1.5 * 10;

          //       // video.id = `participant-${p.userId}`;
          //       // video.classList.add('participant');

          //       // ZoomVideo.createLocalVideoTrack().start(video, {
          //       //   imageUrl: 'blur',
          //       // });

          //       // return video;
          //     } catch (err) {}

          //     return null;
          //   })
          // ).then((results) => {
          //   results.forEach((result) => {
          //     if (result.status === 'fulfilled' && result.value) {
          //       const video = result.value as VideoPlayer;

          //       (result.value as any)?.classList.add(
          //         'bg-gray-100',
          //         'rounded-sm'
          //       );
          //       video.style.width = 16 * 1.5 * 10 + 'px';
          //       video.style.height = 9 * 1.5 * 10 + 'px';

          //       this.listElement?.nativeElement.appendChild(
          //         result.value as HTMLElement
          //       );
          //     }
          //   });
          // });
        });
      });
  }
}