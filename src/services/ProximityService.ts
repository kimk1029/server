import { Room } from '../types/room.types';
import { calculateDistance } from '../utils/distance';
import { Broadcaster } from './Broadcaster';
import { PROXIMITY_ALERT_COOLDOWN_MS } from '../utils/constants';

export class ProximityService {
  private lastAlertTime: Map<string, number> = new Map();

  constructor(private broadcaster: Broadcaster) {}

  checkProximity(room: Room): void {
    if (room.status !== 'CHASE') return;

    const police = Array.from(room.players.values()).filter(p => p.team === 'POLICE');
    const thieves = Array.from(room.players.values()).filter(
      p => p.team === 'THIEF' && p.thiefStatus?.state === 'FREE'
    );

    police.forEach(cop => {
      if (!cop.location) return;

      let minDistance = Infinity;

      thieves.forEach(thief => {
        if (!thief.location) return;

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
