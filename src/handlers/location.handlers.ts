import { RoomManager } from '../managers/RoomManager';

export const handleLocationUpdate = (
  roomId: string,
  playerId: string,
  payload: any,
  roomManager: RoomManager
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
};
