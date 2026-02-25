import { Room } from '../types/room.types';

export const BATTLE_ZONE_DEFAULT_RADIUS_M = 100;
const BATTLE_ZONE_MIN_RATIO = 0.3;
const SHRINK_START_ELAPSED_RATIO = 0.4;

export function getBattleZoneRadiusMeters(room: Room): number | null {
  if (room.settings.gameMode !== 'BATTLE') return null;
  if (room.status !== 'CHASE' && room.status !== 'HIDING') return null;

  const initialRadius = room.settings.battleZoneRadiusM ?? BATTLE_ZONE_DEFAULT_RADIUS_M;
  if (room.status === 'HIDING') return initialRadius;
  if (!room.basecamp || !room.phaseEndsAt) return initialRadius;

  const minRadius = Math.round(initialRadius * BATTLE_ZONE_MIN_RATIO);
  const hidingSeconds = room.settings.hidingSeconds ?? 0;
  const chaseSeconds = room.settings.chaseSeconds;
  const totalMs = (hidingSeconds + chaseSeconds) * 1000;
  const gameStartAt = room.phaseEndsAt - totalMs;
  const now = Date.now();
  const elapsed = now - gameStartAt;

  if (elapsed <= 0) return initialRadius;
  if (elapsed >= totalMs) return minRadius;

  const shrinkStartMs = totalMs * SHRINK_START_ELAPSED_RATIO;
  if (elapsed < shrinkStartMs) return initialRadius;

  const shrinkDurationMs = totalMs * (1 - SHRINK_START_ELAPSED_RATIO);
  const shrinkElapsed = elapsed - shrinkStartMs;
  const progress = Math.min(1, shrinkElapsed / shrinkDurationMs);
  const radius = initialRadius - progress * (initialRadius - minRadius);
  return Math.round(radius);
}

export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
