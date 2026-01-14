import { Room, RoomSettings } from '../types/room.types';
import { generateRoomId } from '../utils/idGenerator';
import { DEFAULT_ROOM_SETTINGS } from '../utils/constants';
import { logger } from '../utils/logger';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(hostId: string, settings?: Partial<RoomSettings>): Room {
    const roomId = generateRoomId(new Set(this.rooms.keys()));
    
    const room: Room = {
      roomId,
      hostId,
      status: 'LOBBY',
      createdAt: Date.now(),
      phaseEndsAt: null,
      settings: {
        ...DEFAULT_ROOM_SETTINGS,
        ...settings
      },
      basecamp: null,
      players: new Map(),
      chatHistory: []
    };

    this.rooms.set(roomId, room);
    logger.info('Room created', { roomId, hostId });
    
    return room;
  }

  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) || null;
  }

  deleteRoom(roomId: string): boolean {
    const deleted = this.rooms.delete(roomId);
    if (deleted) {
      logger.info('Room deleted', { roomId });
    }
    return deleted;
  }

  roomExists(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  getRoomCount(): number {
    return this.rooms.size;
  }
}
