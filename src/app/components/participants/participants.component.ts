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
import {
  ParticipantPropertiesPayload,
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
  @ViewChild('notifContainer')
  notifContainerElement?: ElementRef<HTMLDivElement>;

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
            const videoPlayer = await mediaStream.attachVideo(
              data.userId,
              VideoQuality.Video_90P
            );

            this.appendToParticipantList(
              videoPlayer as VideoPlayer,
              data.userId
            );
          } else {
            const videoPlayer = await mediaStream.detachVideo(data.userId);

            this.queryVideoElement('0')?.remove();
          }
        });

        client.getAllUser().forEach((user) => {
          if (user.userId === client.getCurrentUserInfo().userId) return;

          if (user.bVideoOn) {
            mediaStream
              .attachVideo(user.userId, VideoQuality.Video_1080P)
              .then((userVideo) => {
                this.appendToParticipantList(
                  userVideo as VideoPlayer,
                  user.userId
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
              return { userVideo, userId: p.userId };
            })
          );

          results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value) {
              const video = result.value.userVideo as VideoPlayer;

              video.classList.add('bg-gray-100', 'rounded-sm');

              this.appendToParticipantList(video, result.value.userId);
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

  appendToParticipantList(video: VideoPlayer, userId: number): void {
    const div = document.createElement('div');
    div.className = 'flex flex-col gap-2';

    const button = document.createElement('button');
    button.textContent = 'Remove';
    button.className =
      'focus:outline-none text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5';
    button.onclick = () => {
      this.zoomVideoService.client?.removeUser(userId).then(() => {});
    };

    div.appendChild(video);
    div.appendChild(button);

    this.listElement?.nativeElement.appendChild(div);
  }

  showUserLeftNotif(list: ParticipantPropertiesPayload[]) {
    const div = document.createElement('div');
    div.className =
      'flex gap-2 py-2 px-4 rounded font-medium bg-red-700 text-white';
    div.textContent =
      list.map((user) => user.userIdentity || user.userId).join(', ') +
      (list.length <= 1 ? ' has' : ' have') +
      ' left the call';

    this.notifContainerElement?.nativeElement.appendChild(div);

    setTimeout(() => div.remove(), 5000);
  }
}
