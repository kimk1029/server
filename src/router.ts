import { WebSocket } from 'uWebSockets.js';
import { BaseMessage } from './types/message.types';
import { RoomManager } from './managers/RoomManager';
import { PlayerManager } from './managers/PlayerManager';
import { GameEngine } from './engine/GameEngine';
import { DistanceValidator } from './validators/DistanceValidator';
import { PermissionValidator } from './validators/PermissionValidator';
import { Broadcaster } from './services/Broadcaster';
import { WebRTCSignalingService } from './services/WebRTCSignalingService';
import * as lobbyHandlers from './handlers/lobby.handlers';
import * as gameHandlers from './handlers/game.handlers';
import * as locationHandlers from './handlers/location.handlers';
import * as captureHandlers from './handlers/capture.handlers';
import * as webrtcHandlers from './handlers/webrtc.handlers';
import { logger } from './utils/logger';

export class MessageRouter {
  constructor(
    private roomManager: RoomManager,
    private playerManager: PlayerManager,
    private gameEngine: GameEngine,
    private distanceValidator: DistanceValidator,
    private permissionValidator: PermissionValidator,
    private broadcaster: Broadcaster,
    private webrtcService: WebRTCSignalingService
  ) {}

  handleMessage(_ws: WebSocket<unknown>, message: BaseMessage): void {
    const { type, roomId, playerId, payload } = message;

    if (!playerId) {
      logger.warn('Message without playerId', { type });
      return;
    }

    logger.info('Received message', { type, playerId, roomId });

    try {
      switch (type) {
        case 'room:create':
        case 'CREATE_ROOM':
          logger.info('Creating room', { playerId, nickname: payload?.nickname, settings: payload?.settings });
          lobbyHandlers.handleRoomCreate(
            playerId,
            payload,
            this.roomManager,
            this.playerManager,
            this.broadcaster
          );
          break;

        case 'room:join':
        case 'JOIN_ROOM': // client alias
          if (!roomId) return;
          lobbyHandlers.handleRoomJoin(
            roomId,
            playerId,
            payload,
            this.roomManager,
            this.playerManager,
            this.broadcaster
          );
          break;

        case 'player:ready':
          if (!roomId) return;
          lobbyHandlers.handlePlayerReady(
            roomId,
            playerId,
            payload,
            this.roomManager,
            this.broadcaster
          );
          break;

        case 'chat:send':
          if (!roomId) return;
          lobbyHandlers.handleChatSend(roomId, playerId, payload, this.roomManager, this.broadcaster);
          break;

        case 'room:leave':
        case 'LEAVE_ROOM':
          if (!roomId) return;
          lobbyHandlers.handleRoomLeave(
            roomId,
            playerId,
            this.roomManager,
            this.playerManager,
            this.broadcaster
          );
          break;

        case 'basecamp:set':
          if (!roomId) return;
          lobbyHandlers.handleBasecampSet(
            roomId,
            playerId,
            payload,
            this.roomManager,
            this.playerManager,
            this.broadcaster,
            this.permissionValidator
          );
          break;

        case 'room:settings:update':
          if (!roomId) return;
          lobbyHandlers.handleRoomSettingsUpdate(
            roomId,
            playerId,
            payload,
            this.roomManager,
            this.playerManager,
            this.broadcaster,
            this.permissionValidator
          );
          break;

        case 'team:shuffle':
          if (!roomId) return;
          gameHandlers.handleTeamShuffle(
            roomId,
            playerId,
            this.gameEngine,
            this.permissionValidator,
            this.roomManager,
            this.playerManager
          );
          break;

        case 'game:start':
          if (!roomId) return;
          gameHandlers.handleGameStart(
            roomId,
            playerId,
            this.gameEngine,
            this.permissionValidator,
            this.roomManager,
            this.playerManager
          );
          break;

        case 'location:update':
          if (!roomId) return;
          locationHandlers.handleLocationUpdate(roomId, playerId, payload, this.roomManager);
          break;

        case 'capture:request':
          if (!roomId) return;
          captureHandlers.handleCaptureRequest(
            roomId,
            playerId,
            payload,
            this.roomManager,
            this.distanceValidator,
            this.broadcaster,
            this.gameEngine
          );
          break;

        case 'jail:request':
          if (!roomId) return;
          captureHandlers.handleJailRequest(
            roomId,
            playerId,
            payload,
            this.roomManager,
            this.distanceValidator,
            this.broadcaster,
            this.gameEngine
          );
          break;

        case 'webrtc:signal':
          if (!roomId) return;
          webrtcHandlers.handleWebRTCSignal(roomId, playerId, payload, this.webrtcService);
          break;

        case 'ptt:request':
          if (!roomId) return;
          webrtcHandlers.handlePTTRequest(roomId, playerId, this.webrtcService);
          break;

        case 'ptt:release':
          if (!roomId) return;
          webrtcHandlers.handlePTTRelease(roomId, playerId, this.webrtcService);
          break;

        default:
          logger.warn('Unknown message type', { type, playerId, roomId });
      }
    } catch (error) {
      logger.error('Message handling error', { type, playerId, roomId, error });
    }
  }
}
