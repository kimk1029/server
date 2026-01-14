import { Room } from '../types/room.types';

export class PermissionValidator {
  isHost(room: Room, playerId: string): boolean {
    const player = room.players.get(playerId);
    return player?.role === 'HOST' && room.hostId === playerId;
  }

  isPolice(room: Room, playerId: string): boolean {
    const player = room.players.get(playerId);
    return player?.team === 'POLICE';
  }

  isThief(room: Room, playerId: string): boolean {
    const player = room.players.get(playerId);
    return player?.team === 'THIEF';
  }
}
