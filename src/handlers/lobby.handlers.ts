import { RoomManager } from '../managers/RoomManager';
import { PlayerManager } from '../managers/PlayerManager';
import { Broadcaster } from '../services/Broadcaster';
import { PermissionValidator } from '../validators/PermissionValidator';
import { Player } from '../types/player.types';
import { ChatMessage } from '../types/room.types';
import { generateMessageId } from '../utils/idGenerator';
import { logger } from '../utils/logger';

export const handleRoomCreate = (
  playerId: string,
  payload: any,
  roomManager: RoomManager,
  playerManager: PlayerManager,
  broadcaster: Broadcaster
) => {
  logger.info('handleRoomCreate called', { playerId, payload });
  const { nickname, settings } = payload;

  const room = roomManager.createRoom(playerId, settings);
  logger.info('Room created successfully', { 
    roomId: room.roomId, 
    hostId: playerId, 
    nickname,
    maxPlayers: room.settings.maxPlayers 
  });

  const host: Player = {
    playerId,
    nickname,
    role: 'HOST',
    team: null,
    ready: true,
    connected: true,
    location: null,
    thiefStatus: null
  };

  room.players.set(playerId, host);
  
  logger.info('Host added to room', { 
    playerId, 
    nickname: host.nickname,
    playersCount: room.players.size,
    playerIds: Array.from(room.players.keys())
  });

  // IMPORTANT: 연결 레이어의 playerId -> roomId 매핑을 방 생성 후 실제 roomId로 업데이트해야
  // 브로드캐스트(game:state, chat:new 등)가 해당 방에 연결된 플레이어에게 전달됩니다.
  playerManager.setRoomIdByPlayerId(playerId, room.roomId);

  const ws = playerManager.getConnectionByPlayerId(playerId);
  ws?.send(
    JSON.stringify({
      type: 'room:created',
      success: true,
      data: {
        roomId: room.roomId,
        joinUrl: `policevsthieves://join/${room.roomId}`
      },
      ts: Date.now()
    })
  );

  logger.info('Broadcasting game state with players', {
    roomId: room.roomId,
    playersCount: room.players.size
  });
  broadcaster.broadcastGameState(room);
};

export const handleRoomJoin = (
  roomId: string,
  playerId: string,
  payload: any,
  roomManager: RoomManager,
  playerManager: PlayerManager,
  broadcaster: Broadcaster
) => {
  const { nickname } = payload;
  const room = roomManager.getRoom(roomId);

  const ws = playerManager.getConnectionByPlayerId(playerId);

  if (!room) {
    ws?.send(
      JSON.stringify({
        type: 'room:join',
        success: false,
        error: 'Room not found',
        ts: Date.now()
      })
    );
    return;
  }

  if (room.players.size >= room.settings.maxPlayers) {
    ws?.send(
      JSON.stringify({
        type: 'room:join',
        success: false,
        error: 'Room is full',
        ts: Date.now()
      })
    );
    return;
  }

  const player: Player = {
    playerId,
    nickname,
    role: 'GUEST',
    team: null,
    ready: false,
    connected: true,
    location: null,
    thiefStatus: null
  };

  room.players.set(playerId, player);

  // 이미 연결된 소켓이라도 최초 연결 시 roomId가 ''로 저장되어 있을 수 있으므로
  // join 시점에 반드시 매핑을 roomId로 갱신합니다.
  playerManager.setRoomIdByPlayerId(playerId, roomId);

  ws?.send(
    JSON.stringify({
      type: 'room:join',
      success: true,
      data: { roomId },
      ts: Date.now()
    })
  );

  broadcaster.broadcastGameState(room);
};

export const handleRoomLeave = (
  roomId: string,
  playerId: string,
  roomManager: RoomManager,
  playerManager: PlayerManager,
  broadcaster: Broadcaster
) => {
  const room = roomManager.getRoom(roomId);
  const ws = playerManager.getConnectionByPlayerId(playerId);

  if (!room) {
    ws?.send(
      JSON.stringify({
        type: 'room:leave',
        success: false,
        error: 'Room not found',
        ts: Date.now()
      })
    );
    return;
  }

  const wasHost = room.hostId === playerId;
  const existed = room.players.delete(playerId);
  playerManager.setRoomIdByPlayerId(playerId, ''); // 방 브로드캐스트 대상에서 제외

  logger.info('Player left room', { roomId, playerId, existed, wasHost });

  // 호스트가 나갔다면 남아있는 플레이어 중 첫 번째를 HOST로 승격
  if (wasHost) {
    const next = room.players.values().next().value as Player | undefined;
    if (next) {
      room.hostId = next.playerId;
      next.role = 'HOST';
      logger.info('Host reassigned', { roomId, newHostId: next.playerId });
    }
  }

  // 방에 아무도 없으면 즉시 삭제
  if (room.players.size === 0) {
    roomManager.deleteRoom(roomId);
    logger.info('Room deleted (empty after leave)', { roomId });
    ws?.send(
      JSON.stringify({
        type: 'room:leave',
        success: true,
        data: { roomId, deleted: true },
        ts: Date.now()
      })
    );
    return;
  }

  ws?.send(
    JSON.stringify({
      type: 'room:leave',
      success: true,
      data: { roomId },
      ts: Date.now()
    })
  );

  broadcaster.broadcastGameState(room);
};

export const handlePlayerReady = (
  roomId: string,
  playerId: string,
  payload: any,
  roomManager: RoomManager,
  broadcaster: Broadcaster
) => {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  const player = room.players.get(playerId);
  if (!player) return;

  player.ready = payload.ready;
  broadcaster.broadcastGameState(room);
};

export const handleChatSend = (
  roomId: string,
  playerId: string,
  payload: any,
  roomManager: RoomManager,
  broadcaster: Broadcaster
) => {
  logger.info('handleChatSend called', { roomId, playerId, payload });
  
  const room = roomManager.getRoom(roomId);
  if (!room) {
    logger.warn('Room not found for chat', { roomId });
    return;
  }

  const player = room.players.get(playerId);
  if (!player) {
    logger.warn('Player not found in room for chat', { roomId, playerId, players: Array.from(room.players.keys()) });
    return;
  }

  const message: ChatMessage = {
    messageId: generateMessageId(),
    playerId,
    nickname: player.nickname,
    text: payload.text,
    timestamp: Date.now()
  };

  logger.info('Chat message created', { message });
  room.chatHistory.push(message);

  logger.info('Broadcasting chat message', { roomId, messageId: message.messageId });
  broadcaster.broadcastToRoom(roomId, {
    type: 'chat:new',
    roomId,
    data: message,
    ts: Date.now()
  });
  
  logger.info('Chat message broadcasted successfully');
};

export const handleBasecampSet = (
  roomId: string,
  playerId: string,
  payload: any,
  roomManager: RoomManager,
  playerManager: PlayerManager,
  broadcaster: Broadcaster,
  permissionValidator: PermissionValidator
) => {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  if (!permissionValidator.isHost(room, playerId)) {
    const ws = playerManager.getConnectionByPlayerId(playerId);
    ws?.send(
      JSON.stringify({
        type: 'basecamp:set',
        success: false,
        error: 'Permission denied',
        ts: Date.now()
      })
    );
    return;
  }

  room.basecamp = {
    lat: payload.lat,
    lng: payload.lng,
    setAt: Date.now()
  };

  logger.info('Basecamp set', { roomId, lat: payload.lat, lng: payload.lng });
  broadcaster.broadcastGameState(room);
};
