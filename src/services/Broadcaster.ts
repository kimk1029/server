import { PlayerManager } from '../managers/PlayerManager';
import { Room } from '../types/room.types';
import { GameResult } from '../types/game.types';
import { logger } from '../utils/logger';
import { getBattleZoneRadiusMeters } from '../utils/battleZone';
import type { VisibilityService } from './VisibilityService';

export class Broadcaster {
  private visibility: VisibilityService | null = null;

  constructor(private playerManager: PlayerManager) {}

  setVisibilityService(visibility: VisibilityService): void {
    this.visibility = visibility;
  }

  sendToPlayer(playerId: string, message: any): void {
    const ws = this.playerManager.getConnectionByPlayerId(playerId);
    if (ws) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Failed to send message', { playerId, error });
      }
    }
  }

  broadcastToRoom(roomId: string, message: any): void {
    const connections = this.playerManager.getConnectionsInRoom(roomId);
    logger.info('Broadcasting to room', { 
      roomId, 
      messageType: message.type,
      connectedPlayersCount: connections.length 
    });
    
    if (connections.length === 0) {
      logger.warn('No connected players in room to broadcast to', { roomId });
      return;
    }
    
    const messageStr = JSON.stringify(message);
    connections.forEach((ws, index) => {
      try {
        ws.send(messageStr);
        logger.info('Message sent to player', { roomId, playerIndex: index, messageType: message.type });
      } catch (error) {
        logger.error('Failed to send message to player', { roomId, playerIndex: index, error });
      }
    });
    
    logger.info('Broadcast completed', { roomId, messageType: message.type, recipientCount: connections.length });
  }

  broadcastGameState(room: Room): void {
    const serializedPlayers = this.serializePlayers(room);
    logger.info('Broadcasting game state', {
      roomId: room.roomId,
      playersCount: room.players.size,
      serializedPlayersCount: serializedPlayers.length,
      playerIds: Array.from(room.players.keys())
    });
    
    const zoneRadiusMeters =
      room.settings.gameMode === 'BATTLE' && room.status === 'CHASE'
        ? getBattleZoneRadiusMeters(room)
        : null;

    // 받는 사람마다 볼 수 있는 위치만 포함해서 전송 (경찰에게 먼 도둑 위치가 새지 않도록)
    const ts = Date.now();
    this.playerManager.getPlayersInRoom(room.roomId).forEach(viewerId => {
      const viewer = room.players.get(viewerId);
      const players = serializedPlayers.map(p => {
        const target = room.players.get(p.playerId);
        if (!target || !this.visibility || this.visibility.canSee(room, viewer, target)) return p;
        return { ...p, location: null };
      });
      this.sendToPlayer(viewerId, {
        type: 'game:state',
        roomId: room.roomId,
        data: {
          status: room.status,
          phaseEndsAt: room.phaseEndsAt,
          basecamp: room.basecamp,
          settings: room.settings,
          players,
          ...(zoneRadiusMeters != null && { zoneRadiusMeters })
        },
        ts
      });
    });
    logger.info('Game state broadcasted to room', { roomId: room.roomId });
  }

  /** 위치 업데이트를 볼 수 있는 사람에게만 전송 */
  broadcastLocation(room: Room, playerId: string): void {
    const mover = room.players.get(playerId);
    if (!mover?.location) return;
    const messageStr = JSON.stringify({
      type: 'location:update',
      roomId: room.roomId,
      data: { playerId, location: mover.location, team: mover.team },
      ts: Date.now()
    });
    this.playerManager.getPlayersInRoom(room.roomId).forEach(viewerId => {
      if (viewerId === playerId) return;
      const viewer = room.players.get(viewerId);
      if (this.visibility && !this.visibility.canSee(room, viewer, mover)) return;
      const ws = this.playerManager.getConnectionByPlayerId(viewerId);
      if (!ws) return;
      try {
        ws.send(messageStr);
      } catch (error) {
        logger.error('Failed to send location', { viewerId, error });
      }
    });
  }

  broadcastTeamAssignment(room: Room): void {
    const police = Array.from(room.players.values()).filter(p => p.team === 'POLICE');
    const thieves = Array.from(room.players.values()).filter(p => p.team === 'THIEF');

    room.players.forEach(player => {
      const message = {
        type: 'team:assigned',
        roomId: room.roomId,
        playerId: player.playerId,
        data: {
          yourTeam: player.team,
          roster: {
            police: police.map(p => ({ playerId: p.playerId, nickname: p.nickname })),
            thieves: thieves.map(p => ({ playerId: p.playerId, nickname: p.nickname }))
          }
        },
        ts: Date.now()
      };

      this.sendToPlayer(player.playerId, message);
    });
  }

  broadcastGameEnd(room: Room, result: GameResult): void {
    const message = {
      type: 'game:end',
      roomId: room.roomId,
      data: result,
      ts: Date.now()
    };

    this.broadcastToRoom(room.roomId, message);
  }

  private serializePlayers(room: Room): any[] {
    const players = Array.from(room.players.values()).map(p => ({
      id: p.playerId,
      playerId: p.playerId,
      nickname: p.nickname,
      role: p.role,
      team: p.team,
      ready: p.ready,
      connected: p.connected,
      thiefStatus: p.thiefStatus,
      location: p.location ?? null,
      outOfZoneAt: (p as any).outOfZoneAt ?? null,
      outsideZoneSince: (p as any).outsideZoneSince ?? null,
    }));
    
    logger.info('Serialized players', { 
      count: players.length,
      players: players.map(p => ({ id: p.playerId, nickname: p.nickname, role: p.role, hasLocation: !!p.location }))
    });
    
    return players;
  }
}
