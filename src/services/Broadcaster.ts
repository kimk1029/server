import { PlayerManager } from '../managers/PlayerManager';
import { Room } from '../types/room.types';
import { GameResult } from '../types/game.types';
import { logger } from '../utils/logger';

export class Broadcaster {
  constructor(private playerManager: PlayerManager) {}

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
    
    const message = {
      type: 'game:state',
      roomId: room.roomId,
      data: {
        status: room.status,
        phaseEndsAt: room.phaseEndsAt,
        basecamp: room.basecamp,
        settings: room.settings,
        players: serializedPlayers
      },
      ts: Date.now()
    };

    logger.info('Game state message data', { 
      type: message.type,
      roomId: message.roomId,
      playersCount: serializedPlayers.length,
      playerSample: serializedPlayers[0]
    });
    
    this.broadcastToRoom(room.roomId, message);
    logger.info('Game state broadcasted to room', { roomId: room.roomId });
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
      outOfZoneAt: p.outOfZoneAt ?? null,
      // 실시간 위치 표시를 위해 항상 location 정보 포함
      location: p.location ?? null
    }));
    
    logger.info('Serialized players', { 
      count: players.length,
      players: players.map(p => ({ id: p.playerId, nickname: p.nickname, role: p.role, hasLocation: !!p.location }))
    });
    
    return players;
  }
}
