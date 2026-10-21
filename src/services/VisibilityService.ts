import { Room } from '../types/room.types';
import { Player } from '../types/player.types';
import { calculateDistance } from '../utils/distance';
import { Broadcaster } from './Broadcaster';
import { VISIBILITY_HIDE_EXTRA_METERS } from '../utils/constants';

/**
 * 플레이어별 위치 공개 범위를 결정합니다.
 *
 * - LOBBY / END: 모두 공개
 * - HIDING / CHASE:
 *   - 같은 팀끼리는 항상 공개 (도둑끼리 위치 공유, 경찰끼리 위치 공유)
 *   - 경찰 → 도둑: CHASE 중 근접 반경(proximityRadiusMeters) 안에 있거나,
 *     이미 검거/감금된 도둑만 공개
 *   - 도둑 → 경찰: 비공개
 *
 * 근접 판정은 히스테리시스(반경 진입 시 공개, 반경 + VISIBILITY_HIDE_EXTRA_METERS 벗어날 때 숨김)를
 * 적용해 GPS 오차로 마커가 깜빡이지 않도록 합니다.
 */
export class VisibilityService {
  /** roomId -> policeId -> 현재 공개 중인 thiefId 집합 (근접 + 검거/감금) */
  private visible: Map<string, Map<string, Set<string>>> = new Map();

  constructor(private broadcaster: Broadcaster) {}

  canSee(room: Room, viewer: Player | undefined, target: Player): boolean {
    if (!viewer) return false;
    if (viewer.playerId === target.playerId) return true;
    if (room.status !== 'HIDING' && room.status !== 'CHASE') return true;
    if (!viewer.team || !target.team) return true;
    if (viewer.team === target.team) return true;
    if (viewer.team === 'THIEF') return false;

    // viewer = POLICE, target = THIEF
    if (room.status !== 'CHASE') return false;
    const state = target.thiefStatus?.state;
    if (state === 'CAPTURED' || state === 'JAILED') return true;
    return this.visible.get(room.roomId)?.get(viewer.playerId)?.has(target.playerId) ?? false;
  }

  /**
   * 근접 공개 집합을 다시 계산하고, 변화가 있으면 해당 경찰에게 알립니다.
   * - 새로 보이게 된 도둑: location:update 전송
   * - 더 이상 안 보이는 도둑: location:hidden 전송
   * @param moverId 방금 위치를 보낸 플레이어 (곧 broadcastLocation으로 전송되므로 중복 전송 생략)
   */
  refresh(room: Room, moverId?: string): void {
    const roomVisible = this.visible.get(room.roomId) ?? new Map<string, Set<string>>();
    this.visible.set(room.roomId, roomVisible);

    const players = Array.from(room.players.values());
    const police = players.filter(p => p.team === 'POLICE');
    const thieves = players.filter(p => p.team === 'THIEF');
    const radius = room.settings.proximityRadiusMeters;
    const hideRadius = radius + VISIBILITY_HIDE_EXTRA_METERS;
    const active = room.status === 'CHASE';

    police.forEach(cop => {
      const prev = roomVisible.get(cop.playerId) ?? new Set<string>();
      const next = new Set<string>();

      if (active) {
        thieves.forEach(thief => {
          const state = thief.thiefStatus?.state;
          if (state === 'CAPTURED' || state === 'JAILED') {
            next.add(thief.playerId);
            return;
          }
          if (state !== 'FREE') return;
          if (!cop.location || !thief.location) return;
          const distance = calculateDistance(
            cop.location.lat,
            cop.location.lng,
            thief.location.lat,
            thief.location.lng
          );
          const limit = prev.has(thief.playerId) ? hideRadius : radius;
          if (distance <= limit) next.add(thief.playerId);
        });
      }

      roomVisible.set(cop.playerId, next);

      next.forEach(thiefId => {
        if (prev.has(thiefId) || thiefId === moverId) return;
        const thief = room.players.get(thiefId);
        if (!thief?.location) return;
        this.broadcaster.sendToPlayer(cop.playerId, {
          type: 'location:update',
          roomId: room.roomId,
          data: { playerId: thiefId, location: thief.location, team: thief.team },
          ts: Date.now()
        });
      });

      prev.forEach(thiefId => {
        if (next.has(thiefId)) return;
        // LOBBY/END 전환 등으로 전체 공개 상태가 되면 숨길 필요 없음
        const thief = room.players.get(thiefId);
        if (thief && this.canSee(room, cop, thief)) return;
        this.broadcaster.sendToPlayer(cop.playerId, {
          type: 'location:hidden',
          roomId: room.roomId,
          data: { playerId: thiefId },
          ts: Date.now()
        });
      });
    });
  }

  clearRoom(roomId: string): void {
    this.visible.delete(roomId);
  }
}
