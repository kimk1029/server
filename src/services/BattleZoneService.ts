import { Room } from '../types/room.types';
import { calculateDistance } from '../utils/distance';
import { Broadcaster } from './Broadcaster';
import { getBattleZoneRadiusMeters, BATTLE_ZONE_INITIAL_RADIUS_M } from '../utils/battleZone';
import { logger } from '../utils/logger';

/** 자기장 밖에 있어도 허용되는 시간 (ms) */
const OUT_OF_ZONE_GRACE_MS = 5000;

/** 자기장 체크 주기 (ms) */
export const BATTLE_ZONE_CHECK_INTERVAL_MS = 1000;

/** 플레이어별 자기장 밖 진입 시각 추적 */
const outsideSinceByPlayer = new Map<string, number>();

export class BattleZoneService {
  constructor(private broadcaster: Broadcaster) {}

  checkBattleZone(room: Room): void {
    if (room.settings.gameMode !== 'BATTLE') return;
    if (room.status !== 'HIDING' && room.status !== 'CHASE') return;
    if (!room.basecamp || typeof room.basecamp.lat !== 'number' || typeof room.basecamp.lng !== 'number') return;

    const now = Date.now();
    const basecamp = room.basecamp;

    const radius =
      room.status === 'HIDING'
        ? BATTLE_ZONE_INITIAL_RADIUS_M
        : getBattleZoneRadiusMeters(
            room.phaseEndsAt,
            room.settings.hidingSeconds,
            room.settings.chaseSeconds,
            now
          );

    if (radius == null) return;

    const roomKey = room.roomId;

    for (const player of room.players.values()) {
      if (!player.location) continue;

      const loc = player.location;
      const distance = calculateDistance(basecamp.lat, basecamp.lng, loc.lat, loc.lng);
      const isOutside = distance > radius;

      const playerKey = `${roomKey}:${player.playerId}`;

      if (isOutside) {
        const firstOutsideAt = outsideSinceByPlayer.get(playerKey) ?? now;
        outsideSinceByPlayer.set(playerKey, firstOutsideAt);

        const elapsedOutside = now - firstOutsideAt;
        if (elapsedOutside >= OUT_OF_ZONE_GRACE_MS) {
          this.eliminatePlayer(room, player.playerId);
          outsideSinceByPlayer.delete(playerKey);
        }
      } else {
        outsideSinceByPlayer.delete(playerKey);
      }
    }
  }

  private eliminatePlayer(room: Room, playerId: string): void {
    const player = room.players.get(playerId);
    if (!player) return;

    const now = Date.now();

    if (player.team === 'THIEF') {
      if (player.thiefStatus?.state === 'FREE' || player.thiefStatus?.state === 'CAPTURED') {
        player.thiefStatus = {
          state: 'OUT_OF_ZONE',
          capturedBy: null,
          capturedAt: null,
          jailedAt: null,
        };
        player.outOfZoneAt = now;
        logger.info('Thief eliminated (out of zone)', { roomId: room.roomId, playerId, nickname: player.nickname });
      }
    } else if (player.team === 'POLICE') {
      player.outOfZoneAt = now;
      logger.info('Police eliminated (out of zone)', { roomId: room.roomId, playerId, nickname: player.nickname });
    }

    this.broadcaster.broadcastGameState(room);
  }

  /** 게임/방 종료 시 해당 방 플레이어 추적 초기화 */
  clearRoom(roomId: string): void {
    for (const key of outsideSinceByPlayer.keys()) {
      if (key.startsWith(`${roomId}:`)) outsideSinceByPlayer.delete(key);
    }
  }
}
