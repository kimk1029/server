import { RoomManager } from '../managers/RoomManager';
import { DistanceValidator } from '../validators/DistanceValidator';
import { Broadcaster } from '../services/Broadcaster';
import { GameEngine } from '../engine/GameEngine';
import { logger } from '../utils/logger';

export const handleCaptureRequest = (
  roomId: string,
  playerId: string,
  payload: any,
  roomManager: RoomManager,
  distanceValidator: DistanceValidator,
  broadcaster: Broadcaster,
  _gameEngine: GameEngine
) => {
  const room = roomManager.getRoom(roomId);
  if (!room || room.status !== 'CHASE') {
    broadcaster.sendToPlayer(playerId, {
      type: 'capture:result',
      success: false,
      error: 'Capture allowed only during CHASE phase',
      ts: Date.now()
    });
    return;
  }

  const police = room.players.get(playerId);
  const thief = room.players.get(payload.thiefId);

  if (!police || police.team !== 'POLICE') {
    broadcaster.sendToPlayer(playerId, {
      type: 'capture:result',
      success: false,
      error: 'You are not a police',
      ts: Date.now()
    });
    return;
  }

  if (!thief || thief.team !== 'THIEF') {
    broadcaster.sendToPlayer(playerId, {
      type: 'capture:result',
      success: false,
      error: 'Invalid thief',
      ts: Date.now()
    });
    return;
  }

  if (thief.thiefStatus?.state !== 'FREE') {
    broadcaster.sendToPlayer(playerId, {
      type: 'capture:result',
      success: false,
      error: 'Thief already captured or jailed',
      ts: Date.now()
    });
    return;
  }

  const validation = distanceValidator.validateCapture(
    police.location,
    thief.location,
    room.settings.captureRadiusMeters
  );

  if (!validation.valid) {
    broadcaster.sendToPlayer(playerId, {
      type: 'capture:result',
      success: false,
      error: validation.error,
      ts: Date.now()
    });
    return;
  }

  const now = Date.now();
  thief.thiefStatus = {
    state: 'CAPTURED',
    capturedBy: playerId,
    capturedAt: now,
    jailedAt: null
  };

  broadcaster.broadcastToRoom(roomId, {
    type: 'capture:result',
    success: true,
    data: {
      thiefId: thief.playerId,
      thiefNickname: thief.nickname,
      policeId: police.playerId,
      policeNickname: police.nickname,
      capturedAt: now
    },
    ts: now
  });

  broadcaster.broadcastGameState(room);
  _gameEngine.checkWinCondition(roomId);
  logger.info('Thief captured', { roomId, thiefId: thief.playerId, policeId: police.playerId });
};

export const handleJailRequest = (
  roomId: string,
  playerId: string,
  payload: any,
  roomManager: RoomManager,
  distanceValidator: DistanceValidator,
  broadcaster: Broadcaster,
  _gameEngine: GameEngine
) => {
  const room = roomManager.getRoom(roomId);
  if (!room || room.status !== 'CHASE') {
    broadcaster.sendToPlayer(playerId, {
      type: 'jail:result',
      success: false,
      error: 'Jail allowed only during CHASE phase',
      ts: Date.now()
    });
    return;
  }

  const police = room.players.get(playerId);
  const thief = room.players.get(payload.thiefId);

  if (!police || police.team !== 'POLICE') {
    broadcaster.sendToPlayer(playerId, {
      type: 'jail:result',
      success: false,
      error: 'You are not a police',
      ts: Date.now()
    });
    return;
  }

  if (!thief || thief.team !== 'THIEF') {
    broadcaster.sendToPlayer(playerId, {
      type: 'jail:result',
      success: false,
      error: 'Invalid thief',
      ts: Date.now()
    });
    return;
  }

  if (thief.thiefStatus?.state !== 'CAPTURED' || thief.thiefStatus.capturedBy !== playerId) {
    broadcaster.sendToPlayer(playerId, {
      type: 'jail:result',
      success: false,
      error: 'Thief not captured by you',
      ts: Date.now()
    });
    return;
  }

  const validation = distanceValidator.validateJail(
    police.location,
    room.basecamp,
    room.settings.jailRadiusMeters
  );

  if (!validation.valid) {
    broadcaster.sendToPlayer(playerId, {
      type: 'jail:result',
      success: false,
      error: validation.error,
      ts: Date.now()
    });
    return;
  }

  const now = Date.now();
  thief.thiefStatus!.state = 'JAILED';
  thief.thiefStatus!.jailedAt = now;

  const jailedThieves = Array.from(room.players.values()).filter(
    p => p.team === 'THIEF' && p.thiefStatus?.state === 'JAILED'
  );

  broadcaster.broadcastToRoom(roomId, {
    type: 'jail:result',
    success: true,
    data: {
      thiefId: thief.playerId,
      thiefNickname: thief.nickname,
      jailedAt: now,
      jailRoster: jailedThieves.map(t => ({ playerId: t.playerId, nickname: t.nickname }))
    },
    ts: now
  });

  broadcaster.broadcastGameState(room);
  logger.info('Thief jailed', { roomId, thiefId: thief.playerId, policeId: police.playerId });

  _gameEngine.checkWinCondition(roomId);
};

export const handleReleaseRequest = (
  roomId: string,
  playerId: string,
  payload: any,
  roomManager: RoomManager,
  broadcaster: Broadcaster
) => {
  const room = roomManager.getRoom(roomId);
  if (!room || room.status !== 'CHASE') {
    broadcaster.sendToPlayer(playerId, {
      type: 'release:result',
      success: false,
      error: 'Release allowed only during CHASE phase',
      ts: Date.now()
    });
    return;
  }

  const police = room.players.get(playerId);
  const thief = room.players.get(payload.thiefId);

  if (!police || police.team !== 'POLICE') {
    broadcaster.sendToPlayer(playerId, {
      type: 'release:result',
      success: false,
      error: 'You are not a police',
      ts: Date.now()
    });
    return;
  }

  if (!thief || thief.team !== 'THIEF') {
    broadcaster.sendToPlayer(playerId, {
      type: 'release:result',
      success: false,
      error: 'Invalid thief',
      ts: Date.now()
    });
    return;
  }

  if (thief.thiefStatus?.state !== 'CAPTURED') {
    broadcaster.sendToPlayer(playerId, {
      type: 'release:result',
      success: false,
      error: 'Thief is not captured',
      ts: Date.now()
    });
    return;
  }

  thief.thiefStatus = {
    state: 'FREE',
    capturedBy: null,
    capturedAt: null,
    jailedAt: null
  };

  broadcaster.broadcastToRoom(roomId, {
    type: 'release:result',
    success: true,
    data: {
      thiefId: thief.playerId,
      thiefNickname: thief.nickname,
      policeId: police.playerId,
      policeNickname: police.nickname
    },
    ts: Date.now()
  });

  broadcaster.broadcastGameState(room);
};
