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

  // 게임 상태와 무관하게 위치 업데이트 브로드캐스트
  // (로비/숨기기/추격 상태 모두에서 실시간 위치 표시)
  if (room.status !== 'END') {
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
