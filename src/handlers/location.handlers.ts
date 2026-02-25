import { RoomManager } from '../managers/RoomManager';
import { Broadcaster } from '../services/Broadcaster';
import { GameEngine } from '../engine/GameEngine';
import { calculateDistance } from '../utils/distance';
import { getBattleZoneRadiusMeters } from '../utils/battleZone';
import { logger } from '../utils/logger';

export const handleLocationUpdate = (
  roomId: string,
  playerId: string,
  payload: any,
  roomManager: RoomManager,
  broadcaster: Broadcaster,
  gameEngine?: GameEngine
) => {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  const player = room.players.get(playerId);
  if (!player) return;

  // 이미 탈락(자기장 밖)한 플레이어는 위치 업데이트 무시
  if ((player as any).outOfZoneAt) return;

  player.location = {
    lat: payload.lat,
    lng: payload.lng,
    accuracy: payload.accuracy,
    updatedAt: Date.now()
  };

  // 모든 모드: 베이스캠프가 (0,0)일 때 방장의 첫 위치로 설정
  // game:start 페이로드로 설정 실패 시 폴백 (game:start에서 이미 설정되면 이 조건은 만족 안 됨)
  if (
    (room.status === 'HIDING' || room.status === 'CHASE') &&
    room.basecamp &&
    room.basecamp.lat === 0 &&
    room.basecamp.lng === 0 &&
    player.role === 'HOST'
  ) {
    room.basecamp = {
      lat: payload.lat,
      lng: payload.lng,
      setAt: Date.now()
    };
    logger.info('Basecamp set from HOST first location (fallback)', { roomId, basecamp: room.basecamp });
    broadcaster.broadcastGameState(room);
  }

  // BATTLE 모드: 자기장 밖 5초 유예 후 탈락 (HIDING+CHASE, 경찰/도둑 양팀)
  if (
    room.settings.gameMode === 'BATTLE' &&
    (room.status === 'HIDING' || room.status === 'CHASE') &&
    room.basecamp &&
    (room.basecamp.lat !== 0 || room.basecamp.lng !== 0)
  ) {
    const zoneRadius = getBattleZoneRadiusMeters(room);
    if (zoneRadius != null) {
      const distance = calculateDistance(
        payload.lat, payload.lng,
        room.basecamp.lat, room.basecamp.lng
      );
      const GRACE_SEC = 5;
      if (distance > zoneRadius) {
        const now = Date.now();
        if (!(player as any).outsideZoneSince) {
          (player as any).outsideZoneSince = now;
        }
        const elapsed = (now - (player as any).outsideZoneSince) / 1000;
        if (elapsed >= GRACE_SEC) {
          (player as any).outOfZoneAt = now;
          (player as any).outsideZoneSince = null;
          if (player.team === 'THIEF' && player.thiefStatus) {
            player.thiefStatus.state = 'OUT_OF_ZONE';
          }
          broadcaster.broadcastGameState(room);
          if (gameEngine) gameEngine.checkWinCondition(roomId);
          return;
        }
      } else {
        if ((player as any).outsideZoneSince) {
          (player as any).outsideZoneSince = null;
        }
      }
    }
  }

  // 게임 상태와 무관하게 위치 업데이트 브로드캐스트
  if (room.status !== 'END') {
    console.log('[LOC][Server] location:update broadcast', {
      roomId,
      playerId,
      team: player.team,
      location: player.location,
      status: room.status,
    });
    broadcaster.broadcastToRoom(roomId, {
      type: 'location:update',
      data: {
        playerId,
        location: player.location,
        team: player.team
      },
      ts: Date.now()
    });
  }
};
