import { WebSocket } from 'uWebSockets.js';
import { logger } from '../utils/logger';

export class PlayerManager {
  private connections: Map<string, WebSocket<unknown>> = new Map();
  private playerRooms: Map<string, string> = new Map();
  private wsToPlayer: Map<WebSocket<unknown>, string> = new Map();

  addConnection(playerId: string, ws: WebSocket<unknown>, roomId: string): void {
    this.connections.set(playerId, ws);
    this.playerRooms.set(playerId, roomId);
    this.wsToPlayer.set(ws, playerId);
    
    const roomInfo = roomId ? ` (Room: ${roomId})` : '';
    logger.info(`✅ 접속했습니다 [${playerId}]${roomInfo}`);
  }

  removeConnection(playerId: string): void {
    const ws = this.connections.get(playerId);
    if (ws) {
      this.wsToPlayer.delete(ws);
    }
    
    const roomId = this.playerRooms.get(playerId);
    this.connections.delete(playerId);
    this.playerRooms.delete(playerId);
    
    const roomInfo = roomId ? ` (Room: ${roomId})` : '';
    logger.info(`❌ 접속 해제되었습니다 [${playerId}]${roomInfo}`);
  }

  getPlayerIdByWS(ws: WebSocket<unknown>): string | null {
    return this.wsToPlayer.get(ws) || null;
  }

  getConnectionByPlayerId(playerId: string): WebSocket<unknown> | null {
    return this.connections.get(playerId) || null;
  }

  getRoomIdByPlayerId(playerId: string): string | null {
    return this.playerRooms.get(playerId) || null;
  }

  setRoomIdByPlayerId(playerId: string, roomId: string): void {
    const prev = this.playerRooms.get(playerId) || '';
    this.playerRooms.set(playerId, roomId);
    logger.info('Player room updated', { playerId, prevRoomId: prev, roomId });
  }

  getPlayersInRoom(roomId: string): string[] {
    const players: string[] = [];
    for (const [playerId, pRoomId] of this.playerRooms.entries()) {
      if (pRoomId === roomId) {
        players.push(playerId);
      }
    }
    return players;
  }

  getConnectionsInRoom(roomId: string): WebSocket<unknown>[] {
    const connections: WebSocket<unknown>[] = [];
    for (const [playerId, pRoomId] of this.playerRooms.entries()) {
      if (pRoomId === roomId) {
        const ws = this.connections.get(playerId);
        if (ws) {
          connections.push(ws);
        }
      }
    }
    return connections;
  }

  isConnected(playerId: string): boolean {
    return this.connections.has(playerId);
  }
}
