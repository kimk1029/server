export const DEFAULT_ROOM_SETTINGS = {
  maxPlayers: 20,
  gameMode: 'BASIC' as const,
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
