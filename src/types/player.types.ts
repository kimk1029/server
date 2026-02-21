export type PlayerRole = 'HOST' | 'GUEST';
export type Team = 'POLICE' | 'THIEF';

export interface Location {
  lat: number;
  lng: number;
  accuracy: number;
  updatedAt: number;
}

export interface ThiefStatus {
  state: 'FREE' | 'CAPTURED' | 'JAILED' | 'OUT_OF_ZONE';
  capturedBy: string | null;
  capturedAt: number | null;
  jailedAt: number | null;
}

export interface Player {
  playerId: string;
  nickname: string;
  role: PlayerRole;
  team: Team | null;
  ready: boolean;
  connected: boolean;
  location: Location | null;
  thiefStatus: ThiefStatus | null;
  /** BATTLE 모드: 자기장 밖으로 나가 탈락한 시각 (ms) */
  outOfZoneAt?: number | null;
  /** BATTLE 모드: 자기장 밖에 처음 진입한 시각 (5초 유예용) */
  outsideZoneSince?: number | null;
}
