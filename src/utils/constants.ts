export const DEFAULT_ROOM_SETTINGS = {
  maxPlayers: 20,
  gameMode: 'BASIC' as 'BASIC' | 'BATTLE',
  hidingSeconds: 60,
  chaseSeconds: 300, // 기본 5분
  proximityRadiusMeters: 30,
  captureRadiusMeters: 10,
  jailRadiusMeters: 15
};

export const MAX_LOCATION_AGE_MS = parseInt(process.env.MAX_LOCATION_AGE_MS || '20000', 10);
export const PROXIMITY_CHECK_INTERVAL_MS = 1000;
export const PROXIMITY_ALERT_COOLDOWN_MS = 2000;
export const ROOM_CLEANUP_INTERVAL_MS = 60000;
export const ROOM_MAX_IDLE_MS = 600000; // 10분

/** 근접 공개 해제 여유 거리 (반경 + N m 벗어나야 다시 숨김, GPS 오차로 인한 깜빡임 방지) */
export const VISIBILITY_HIDE_EXTRA_METERS = 10;
/** PTT 최대 점유 시간 (해제 메시지가 유실돼도 무전이 잠기지 않도록) */
export const PTT_MAX_HOLD_MS = 30000;
