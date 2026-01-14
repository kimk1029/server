import { RoomManager } from '../managers/RoomManager';
import { Broadcaster } from './Broadcaster';
import { logger } from '../utils/logger';

export class WebRTCSignalingService {
  private pttTokens: Map<string, string | null> = new Map();

  constructor(
    private roomManager: RoomManager,
    private broadcaster: Broadcaster
  ) {}

  relaySignal(roomId: string, fromPlayerId: string, payload: any): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    const sender = room.players.get(fromPlayerId);
    if (!sender || sender.team !== 'THIEF') {
      logger.warn('Non-thief tried to send WebRTC signal', { fromPlayerId, roomId });
      return;
    }

    const targetId = payload.targetId;

    if (targetId === 'broadcast') {
      const thieves = Array.from(room.players.values()).filter(
        p => p.team === 'THIEF' && p.playerId !== fromPlayerId
      );

      thieves.forEach(thief => {
        this.broadcaster.sendToPlayer(thief.playerId, {
          type: 'webrtc:signal',
          roomId,
          playerId: fromPlayerId,
          data: { signal: payload.signal },
          ts: Date.now()
        });
      });
    } else {
      const target = room.players.get(targetId);
      if (target && target.team === 'THIEF') {
        this.broadcaster.sendToPlayer(targetId, {
          type: 'webrtc:signal',
          roomId,
          playerId: fromPlayerId,
          data: { signal: payload.signal },
          ts: Date.now()
        });
      }
    }
  }

  requestPTT(roomId: string, playerId: string): boolean {
    const currentHolder = this.pttTokens.get(roomId);

    if (currentHolder && currentHolder !== playerId) {
      return false;
    }

    this.pttTokens.set(roomId, playerId);

    const room = this.roomManager.getRoom(roomId);
    if (room) {
      const player = room.players.get(playerId);
      const thieves = Array.from(room.players.values()).filter(p => p.team === 'THIEF');

      thieves.forEach(thief => {
        this.broadcaster.sendToPlayer(thief.playerId, {
          type: 'ptt:status',
          roomId,
          playerId: thief.playerId,
          data: {
            activeThiefId: playerId,
            activeThiefNickname: player?.nickname || ''
          },
          ts: Date.now()
        });
      });
    }

    return true;
  }

  releasePTT(roomId: string, playerId: string): void {
    const currentHolder = this.pttTokens.get(roomId);

    if (currentHolder === playerId) {
      this.pttTokens.set(roomId, null);

      const room = this.roomManager.getRoom(roomId);
      if (room) {
        const thieves = Array.from(room.players.values()).filter(p => p.team === 'THIEF');

        thieves.forEach(thief => {
          this.broadcaster.sendToPlayer(thief.playerId, {
            type: 'ptt:status',
            roomId,
            playerId: thief.playerId,
            data: {
              activeThiefId: null,
              activeThiefNickname: null
            },
            ts: Date.now()
          });
        });
      }
    }
  }
}
