import { RoomManager } from '../managers/RoomManager';
import { Broadcaster } from './Broadcaster';
import { logger } from '../utils/logger';
import { PTT_MAX_HOLD_MS } from '../utils/constants';

export class WebRTCSignalingService {
  private pttTokens: Map<string, string | null> = new Map();
  private pttTimers: Map<string, NodeJS.Timeout> = new Map();

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
    const room = this.roomManager.getRoom(roomId);
    if (!room) return false;

    const requester = room.players.get(playerId);
    if (!requester || requester.team !== 'THIEF') {
      logger.warn('Non-thief tried to request PTT', { roomId, playerId });
      return false;
    }

    const currentHolder = this.pttTokens.get(roomId);

    if (currentHolder && currentHolder !== playerId) {
      const holder = room.players.get(currentHolder);
      this.broadcaster.sendToPlayer(playerId, {
        type: 'ptt:status',
        roomId,
        playerId,
        data: {
          activeThiefId: currentHolder,
          activeThiefNickname: holder?.nickname || ''
        },
        ts: Date.now()
      });
      return false;
    }

    this.pttTokens.set(roomId, playerId);

    // 해제 메시지가 유실되더라도 무전이 영구히 잠기지 않도록 최대 점유 시간 후 자동 해제
    const prevTimer = this.pttTimers.get(roomId);
    if (prevTimer) clearTimeout(prevTimer);
    this.pttTimers.set(
      roomId,
      setTimeout(() => {
        if (this.pttTokens.get(roomId) === playerId) {
          logger.info('PTT auto-released (max hold)', { roomId, playerId });
          this.forceReleasePTT(roomId, playerId);
        }
      }, PTT_MAX_HOLD_MS)
    );

    const thieves = Array.from(room.players.values()).filter(p => p.team === 'THIEF');

    thieves.forEach(thief => {
      this.broadcaster.sendToPlayer(thief.playerId, {
        type: 'ptt:status',
        roomId,
        playerId: thief.playerId,
        data: {
          activeThiefId: playerId,
          activeThiefNickname: requester.nickname || ''
        },
        ts: Date.now()
      });
    });

    return true;
  }

  releasePTT(roomId: string, playerId: string): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    const requester = room.players.get(playerId);
    if (!requester || requester.team !== 'THIEF') {
      logger.warn('Non-thief tried to release PTT', { roomId, playerId });
      return;
    }

    this.forceReleasePTT(roomId, playerId);
  }

  /** 팀 검증 없이 해제 (연결 끊김/방 나감/팀 변경 시) */
  forceReleasePTT(roomId: string, playerId: string): void {
    if (this.pttTokens.get(roomId) !== playerId) return;

    this.pttTokens.set(roomId, null);
    const timer = this.pttTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.pttTimers.delete(roomId);
    }

    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

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
