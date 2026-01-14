import uWS, { WebSocket } from 'uWebSockets.js';
import { RoomManager } from './managers/RoomManager';
import { PlayerManager } from './managers/PlayerManager';
import { GameEngine } from './engine/GameEngine';
import { StateMachine } from './engine/StateMachine';
import { TeamAssigner } from './engine/TeamAssigner';
import { WinConditionChecker } from './engine/WinConditionChecker';
import { DistanceValidator } from './validators/DistanceValidator';
import { PermissionValidator } from './validators/PermissionValidator';
import { Broadcaster } from './services/Broadcaster';
import { ProximityService } from './services/ProximityService';
import { WebRTCSignalingService } from './services/WebRTCSignalingService';
import { MessageRouter } from './router';
import { logger } from './utils/logger';
import {
  PROXIMITY_CHECK_INTERVAL_MS,
  ROOM_CLEANUP_INTERVAL_MS,
  ROOM_MAX_IDLE_MS
} from './utils/constants';

const PORT = parseInt(process.env.PORT || '9001', 10);

export const startServer = () => {
  const roomManager = new RoomManager();
  const playerManager = new PlayerManager();
  const broadcaster = new Broadcaster(playerManager);
  const stateMachine = new StateMachine();
  const teamAssigner = new TeamAssigner();
  const winChecker = new WinConditionChecker();
  const distanceValidator = new DistanceValidator();
  const permissionValidator = new PermissionValidator();
  const proximityService = new ProximityService(broadcaster);
  const webrtcService = new WebRTCSignalingService(roomManager, broadcaster);

  const gameEngine = new GameEngine(
    roomManager,
    stateMachine,
    teamAssigner,
    winChecker,
    broadcaster
  );

  const messageRouter = new MessageRouter(
    roomManager,
    playerManager,
    gameEngine,
    distanceValidator,
    permissionValidator,
    broadcaster,
    webrtcService
  );

  const app = uWS.App({
    // SSL 설정 (프로덕션)
    // key_file_name: 'key.pem',
    // cert_file_name: 'cert.pem'
  });

  app.ws('/*', {
    compression: uWS.SHARED_COMPRESSOR,
    maxPayloadLength: 16 * 1024,
    idleTimeout: 60,

    open: (_ws: WebSocket<unknown>) => {
      logger.info('WebSocket connection opened');
    },

    message: (ws: WebSocket<unknown>, message: ArrayBuffer, _isBinary: boolean) => {
      try {
        const text = Buffer.from(message).toString('utf8');
        const data = JSON.parse(text);

        const playerId = data.playerId;
        if (playerId && !playerManager.isConnected(playerId)) {
          const roomId = data.roomId || '';
          playerManager.addConnection(playerId, ws, roomId);
        }

        messageRouter.handleMessage(ws, data);
      } catch (error) {
        logger.error('Message parse error', { error });
      }
    },

    close: (ws: WebSocket<unknown>, code: number, _message: ArrayBuffer) => {
      logger.info('WebSocket connection closed', { code });

      const playerId = playerManager.getPlayerIdByWS(ws);
      if (playerId) {
        const roomId = playerManager.getRoomIdByPlayerId(playerId);
        if (roomId) {
          const room = roomManager.getRoom(roomId);
          if (room) {
            const wasHost = room.hostId === playerId;
            const existed = room.players.delete(playerId);
            logger.info('Player removed on socket close', { roomId, playerId, existed, wasHost });

            if (wasHost) {
              const next = room.players.values().next().value as any;
              if (next) {
                room.hostId = next.playerId;
                next.role = 'HOST';
                logger.info('Host reassigned (socket close)', { roomId, newHostId: next.playerId });
              }
            }

            if (room.players.size === 0) {
              roomManager.deleteRoom(room.roomId);
              logger.info('Room deleted (empty after socket close)', { roomId: room.roomId });
            } else {
              broadcaster.broadcastGameState(room);
            }
          }
        }
        playerManager.removeConnection(playerId);
      }
    }
  });

  // WSL2 환경에서 Windows(adb.exe) ↔ WSL 네트워크가 분리되어 있어,
  // 서버가 127.0.0.1(localhost)에만 바인딩되면 ADB reverse를 통해 들어오는 연결이
  // WSL의 외부 IP로 전달되면서 접속이 실패할 수 있습니다.
  // 따라서 모든 인터페이스(0.0.0.0)에 바인딩해서 디바이스/에뮬레이터 접속을 보장합니다.
  app.listen('0.0.0.0', PORT, (token: any) => {
    if (token) {
      logger.info(`Server listening on 0.0.0.0:${PORT}`);
    } else {
      logger.error('Failed to start server');
      process.exit(1);
    }
  });

  setInterval(() => {
    const rooms = roomManager.getAllRooms();
    rooms.forEach(room => {
      if (room.status === 'CHASE') {
        proximityService.checkProximity(room);
      }
    });
  }, PROXIMITY_CHECK_INTERVAL_MS);

  setInterval(() => {
    const now = Date.now();
    const rooms = roomManager.getAllRooms();

    rooms.forEach(room => {
      const inactive = now - room.createdAt > ROOM_MAX_IDLE_MS;
      const empty = room.players.size === 0;

      if (inactive || empty) {
        roomManager.deleteRoom(room.roomId);
        logger.info('Room cleaned up', { roomId: room.roomId, reason: inactive ? 'inactive' : 'empty' });
      }
    });
  }, ROOM_CLEANUP_INTERVAL_MS);

  logger.info('Server initialized successfully');
};
