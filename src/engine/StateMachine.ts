import { Room, RoomStatus } from '../types/room.types';
import { logger } from '../utils/logger';

export class StateMachine {
  transition(room: Room, newStatus: RoomStatus): void {
    const currentStatus = room.status;

    if (!this.canTransition(currentStatus, newStatus)) {
      throw new Error(`Cannot transition from ${currentStatus} to ${newStatus}`);
    }

    room.status = newStatus;
    this.onEnter(room, newStatus);

    logger.info('Room status changed', {
      roomId: room.roomId,
      from: currentStatus,
      to: newStatus
    });
  }

  private canTransition(from: RoomStatus, to: RoomStatus): boolean {
    const rules: Record<RoomStatus, RoomStatus[]> = {
      LOBBY: ['HIDING'],
      HIDING: ['CHASE'],
      CHASE: ['END'],
      END: []
    };

    return rules[from]?.includes(to) || false;
  }

  private onEnter(room: Room, status: RoomStatus): void {
    const now = Date.now();

    switch (status) {
      case 'LOBBY':
        room.phaseEndsAt = null;
        break;

      case 'HIDING':
        room.phaseEndsAt = now + room.settings.hidingSeconds * 1000;
        break;

      case 'CHASE':
        room.phaseEndsAt = now + room.settings.chaseSeconds * 1000;
        break;

      case 'END':
        room.phaseEndsAt = null;
        break;
    }
  }
}
