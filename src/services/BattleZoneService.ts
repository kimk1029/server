import { Room } from '../types/room.types';
import { Broadcaster } from './Broadcaster';
import { getBattleZoneRadiusMeters } from '../utils/battleZone';
import { logger } from '../utils/logger';

export const BATTLE_ZONE_CHECK_INTERVAL_MS = 1000;

const OUT_OF_ZONE_GRACE_MS = 5000;
const outsideSinceByPlayer = new Map<string, number>();

export class BattleZoneService {
  private onPlayerEliminated?: (roomId: string, playerId: string) => void;

  constructor(private broadcaster: Broadcaster) {}

  setEliminateCallback(cb: (roomId: string, playerId: string) => void): void {
    this.onPlayerEliminated = cb;
  }

  checkBattleZone(room: Room): void {
    if (room.settings.gameMode !== 'BATTLE') return;
    if (room.status !== 'HIDING' && room.status !== 'CHASE') return;
    if (
      !room.basecamp ||
      typeof room.basecamp.lat !== 'number' ||
      typeof room.basecamp.lng !== 'number' ||
      (room.basecamp.lat === 0 && room.basecamp.lng === 0)
    ) return;

    const now = Date.now();
    const basecamp = room.basecamp;
    const radius = getBattleZoneRadiusMeters(room);
    if (radius == null) return;

    const roomKey = room.roomId;

    for (const player of room.players.values()) {
      if ((player as any).outOfZoneAt) continue;
      if (!player.location) continue;

      const loc = player.location;
      const dx = (loc.lat - basecamp.lat) * 111000;
      const dy = (loc.lng - basecamp.lng) * 111000 * Math.cos((basecamp.lat * Math.PI) / 180);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const playerKey = `${roomKey}:${player.playerId}`;

      if (distance > radius) {
        const firstOutsideAt = outsideSinceByPlayer.get(playerKey) ?? now;
        outsideSinceByPlayer.set(playerKey, firstOutsideAt);

        if (now - firstOutsideAt >= OUT_OF_ZONE_GRACE_MS) {
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
    if (!player || (player as any).outOfZoneAt) return;

    const now = Date.now();

    if (player.team === 'THIEF') {
      if (player.thiefStatus?.state === 'FREE' || player.thiefStatus?.state === 'CAPTURED') {
        player.thiefStatus = {
          state: 'OUT_OF_ZONE',
          capturedBy: null,
          capturedAt: null,
          jailedAt: null,
        };
        (player as any).outOfZoneAt = now;
        logger.info('Thief eliminated (out of zone)', { roomId: room.roomId, playerId });
      }
    } else if (player.team === 'POLICE') {
      (player as any).outOfZoneAt = now;
      logger.info('Police eliminated (out of zone)', { roomId: room.roomId, playerId });
    }

    this.broadcaster.broadcastGameState(room);

    if (this.onPlayerEliminated) {
      this.onPlayerEliminated(room.roomId, playerId);
    }
  }

  clearRoom(roomId: string): void {
    for (const key of outsideSinceByPlayer.keys()) {
      if (key.startsWith(`${roomId}:`)) outsideSinceByPlayer.delete(key);
    }
  }
}
