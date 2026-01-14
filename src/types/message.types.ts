export interface BaseMessage {
  type: string;
  roomId?: string;
  playerId?: string;
  ts: number;
  payload?: any;
}

export interface ServerResponse {
  type: string;
  roomId?: string;
  playerId?: string;
  success?: boolean;
  error?: string;
  data?: any;
  ts: number;
}
