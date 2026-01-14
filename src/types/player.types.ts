export type PlayerRole = 'HOST' | 'GUEST';
export type Team = 'POLICE' | 'THIEF';

export interface Location {
  lat: number;
  lng: number;
  accuracy: number;
  updatedAt: number;
}

export interface ThiefStatus {
  state: 'FREE' | 'CAPTURED' | 'JAILED';
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
}
