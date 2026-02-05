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
import { BattleZoneService, BATTLE_ZONE_CHECK_INTERVAL_MS } from './services/BattleZoneService';
import { WebRTCSignalingService } from './services/WebRTCSignalingService';
import { MessageRouter } from './router';
import { logger } from './utils/logger';
import { ROOM_CLEANUP_INTERVAL_MS, ROOM_MAX_IDLE_MS } from './utils/constants';

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
  const battleZoneService = new BattleZoneService(broadcaster);
  const webrtcService = new WebRTCSignalingService(roomManager, broadcaster);

  const gameEngine = new GameEngine(
    roomManager,
    stateMachine,
    teamAssigner,
    winChecker,
    broadcaster,
    battleZoneService
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
      // playerId는 첫 메시지에서 받아오므로 여기서는 연결만 로그
      logger.info('🔌 WebSocket 연결 수립');
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

        // location:update 메시지 특별 로깅
        if (data.type === 'location:update') {
          logger.info('[LOC][Server] Raw location:update received', {
            playerId: data.playerId,
            roomId: data.roomId,
            hasPayload: !!data.payload,
          });
        }

        messageRouter.handleMessage(ws, data);
      } catch (error) {
        logger.error('Message parse error', { error, message: Buffer.from(message).toString('utf8').substring(0, 200) });
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
            const player = room.players.get(playerId);
            if (player) {
              player.connected = false;
              room.players.set(playerId, player);
              logger.info('Player marked disconnected (socket close)', { roomId, playerId });
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
      logger.info(`✅ 서버가 포트 ${PORT}에서 실행 중입니다 (0.0.0.0:${PORT})`);
      logger.info('📡 WebSocket 연결 대기 중...');
    } else {
      logger.error('❌ 서버 시작 실패');
      process.exit(1);
    }
  });

  setInterval(() => {
    const rooms = roomManager.getAllRooms();
    rooms.forEach(room => {
      if (room.status === 'CHASE') {
        proximityService.checkProximity(room);
      }
      battleZoneService.checkBattleZone(room);
    });
  }, BATTLE_ZONE_CHECK_INTERVAL_MS);

  setInterval(() => {
    const now = Date.now();
    const rooms = roomManager.getAllRooms();

    rooms.forEach(room => {
      const inactive = now - room.createdAt > ROOM_MAX_IDLE_MS;
      const empty = room.players.size === 0;

      if (inactive || empty) {
        battleZoneService.clearRoom(room.roomId);
        roomManager.deleteRoom(room.roomId);
        logger.info('Room cleaned up', { roomId: room.roomId, reason: inactive ? 'inactive' : 'empty' });
      }
    });
  }, ROOM_CLEANUP_INTERVAL_MS);

  logger.info('Server initialized successfully');
};
