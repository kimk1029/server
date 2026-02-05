export type RoomStatus = 'LOBBY' | 'HIDING' | 'CHASE' | 'END';

export type GameMode = 'BASIC' | 'BATTLE' | 'ITEM_FIND';

export interface RoomSettings {
  maxPlayers: number;
  gameMode: GameMode;
  hidingSeconds: number;
  chaseSeconds: number;
  proximityRadiusMeters: number;
  captureRadiusMeters: number;
  jailRadiusMeters: number;
}

export interface Basecamp {
  lat: number;
  lng: number;
  setAt: number;
}

export interface ChatMessage {
  messageId: string;
  playerId: string;
  nickname: string;
  text: string;
  timestamp: number;
}

export interface Room {
  roomId: string;
  hostId: string;
  status: RoomStatus;
  createdAt: number;
  phaseEndsAt: number | null;
  settings: RoomSettings;
  basecamp: Basecamp | null;
  players: Map<string, import('./player.types').Player>;
  chatHistory: ChatMessage[];
}
