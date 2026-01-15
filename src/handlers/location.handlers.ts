import { RoomManager } from '../managers/RoomManager';
import { Broadcaster } from '../services/Broadcaster';

export const handleLocationUpdate = (
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

  player.location = {
    lat: payload.lat,
    lng: payload.lng,
    accuracy: payload.accuracy,
    updatedAt: Date.now()
  };

  // 게임 중일 때만 위치 업데이트 브로드캐스트
  if (room.status === 'HIDING' || room.status === 'CHASE') {
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
