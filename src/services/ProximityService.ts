import { Room } from '../types/room.types';
import { calculateDistance } from '../utils/distance';
import { Broadcaster } from './Broadcaster';
import { PROXIMITY_ALERT_COOLDOWN_MS, MAX_LOCATION_AGE_MS } from '../utils/constants';

export class ProximityService {
  private lastAlertTime: Map<string, number> = new Map();

  constructor(private broadcaster: Broadcaster) {}

  checkProximity(room: Room): void {
    if (room.status !== 'CHASE') return;

    const police = Array.from(room.players.values()).filter(p => p.team === 'POLICE');
    const thieves = Array.from(room.players.values()).filter(
      p => p.team === 'THIEF' && p.thiefStatus?.state === 'FREE'
    );

    const now = Date.now();
    const isFresh = (updatedAt: number) => now - updatedAt <= MAX_LOCATION_AGE_MS;

    police.forEach(cop => {
      if (!cop.location || !isFresh(cop.location.updatedAt)) return;

      let minDistance = Infinity;

      thieves.forEach(thief => {
        // 오래된 위치(연결 끊김 등)로 잘못된 근접 알림이 가지 않도록 제외
        if (!thief.location || !isFresh(thief.location.updatedAt)) return;

        const distance = calculateDistance(
          cop.location!.lat,
          cop.location!.lng,
          thief.location!.lat,
          thief.location!.lng
        );

        if (distance < minDistance) {
          minDistance = distance;
        }
      });

      if (minDistance <= room.settings.proximityRadiusMeters) {
        this.sendProximityAlert(room.roomId, cop.playerId, minDistance);
      }
    });
  }

  private sendProximityAlert(roomId: string, policeId: string, distance: number): void {
    const now = Date.now();
    const lastAlert = this.lastAlertTime.get(policeId) || 0;

    if (now - lastAlert < PROXIMITY_ALERT_COOLDOWN_MS) {
      return;
    }

    this.lastAlertTime.set(policeId, now);

    this.broadcaster.sendToPlayer(policeId, {
      type: 'proximity:near',
      roomId,
      playerId: policeId,
      data: {
        message: '근처에 도둑이 있습니다!!',
        distance: Math.round(distance)
      },
      ts: now
    });
  }
}
