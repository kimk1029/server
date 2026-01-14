import { GameEngine } from '../engine/GameEngine';
import { RoomManager } from '../managers/RoomManager';
import { PlayerManager } from '../managers/PlayerManager';
import { PermissionValidator } from '../validators/PermissionValidator';

export const handleTeamShuffle = (
  roomId: string,
  playerId: string,
  gameEngine: GameEngine,
  permissionValidator: PermissionValidator,
  roomManager: RoomManager,
  playerManager: PlayerManager
) => {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  if (!permissionValidator.isHost(room, playerId)) {
    const ws = playerManager.getConnectionByPlayerId(playerId);
    ws?.send(
      JSON.stringify({
        type: 'team:shuffle',
        success: false,
        error: 'Permission denied',
        ts: Date.now()
      })
    );
    return;
  }

  try {
    gameEngine.shuffleTeams(roomId);
  } catch (error: any) {
    const ws = playerManager.getConnectionByPlayerId(playerId);
    ws?.send(
      JSON.stringify({
        type: 'team:shuffle',
        success: false,
        error: error.message,
        ts: Date.now()
      })
    );
  }
};

export const handleGameStart = (
  roomId: string,
  playerId: string,
  gameEngine: GameEngine,
  permissionValidator: PermissionValidator,
  roomManager: RoomManager,
  playerManager: PlayerManager
) => {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  if (!permissionValidator.isHost(room, playerId)) {
    const ws = playerManager.getConnectionByPlayerId(playerId);
    ws?.send(
      JSON.stringify({
        type: 'game:start',
        success: false,
        error: 'Permission denied',
        ts: Date.now()
      })
    );
    return;
  }

  try {
    gameEngine.startGame(roomId);
  } catch (error: any) {
    const ws = playerManager.getConnectionByPlayerId(playerId);
    ws?.send(
      JSON.stringify({
        type: 'game:start',
        success: false,
        error: error.message,
        ts: Date.now()
      })
    );
  }
};
