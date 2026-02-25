import { RoomManager } from '../managers/RoomManager';
import { StateMachine } from './StateMachine';
import { TeamAssigner } from './TeamAssigner';
import { WinConditionChecker } from './WinConditionChecker';
import { Broadcaster } from '../services/Broadcaster';
import { BattleZoneService } from '../services/BattleZoneService';
import { logger } from '../utils/logger';

export class GameEngine {
  private phaseTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private roomManager: RoomManager,
    private stateMachine: StateMachine,
    private teamAssigner: TeamAssigner,
    private winChecker: WinConditionChecker,
    private broadcaster: Broadcaster,
    private battleZoneService: BattleZoneService
  ) {}

  shuffleTeams(roomId: string): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room || room.status !== 'LOBBY') {
      throw new Error('Cannot shuffle teams');
    }

    const players = Array.from(room.players.values());
    const { police, thieves } = this.teamAssigner.assign(players);

    police.forEach(p => {
      const player = room.players.get(p.playerId);
      if (player) {
        player.team = 'POLICE';
      }
    });

    thieves.forEach(p => {
      const player = room.players.get(p.playerId);
      if (player) {
        player.team = 'THIEF';
        player.thiefStatus = {
          state: 'FREE',
          capturedBy: null,
          capturedAt: null,
          jailedAt: null
        };
      }
    });

    this.broadcaster.broadcastTeamAssignment(room);
    // 로비 UI(플레이어 목록/팀 표시) 업데이트를 위해 game:state도 같이 브로드캐스트
    this.broadcaster.broadcastGameState(room);
    logger.info('Teams shuffled', { roomId, policeCount: police.length, thiefCount: thieves.length });
  }

  startGame(roomId: string, payload?: { basecamp?: { lat: number; lng: number } }): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) throw new Error('Room not found');

    // 모든 모드: 방장의 현재 위치를 베이스캠프로 설정 (game:start 페이로드로 전달됨)
    const basecampFromPayload = payload?.basecamp;
    if (
      basecampFromPayload &&
      typeof basecampFromPayload.lat === 'number' &&
      typeof basecampFromPayload.lng === 'number' &&
      isFinite(basecampFromPayload.lat) &&
      isFinite(basecampFromPayload.lng)
    ) {
      room.basecamp = {
        lat: basecampFromPayload.lat,
        lng: basecampFromPayload.lng,
        setAt: Date.now()
      };
      logger.info('Basecamp set from host position', { roomId, basecamp: room.basecamp });
    }

    // 개발/테스트 편의: basecamp 미설정이어도 시작 허용
    if (!room.basecamp) {
      room.basecamp = { lat: 0, lng: 0, setAt: Date.now() } as any;
      logger.warn('Basecamp not set - using default (0,0) for start', { roomId });
    }
    if (room.players.size < 2) throw new Error('Not enough players');
    // 팀 섞기 이후에만 시작 가능
    const unassigned = Array.from(room.players.values()).some(p => !p.team);
    if (unassigned) throw new Error('Teams not assigned');

    this.stateMachine.transition(room, 'HIDING');
    this.broadcaster.broadcastGameState(room);

    const hidingTimer = setTimeout(() => {
      this.endHidingPhase(roomId);
    }, room.settings.hidingSeconds * 1000);

    this.phaseTimers.set(`${roomId}-hiding`, hidingTimer);
    logger.info('Game started', { roomId });
  }

  private endHidingPhase(roomId: string): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room || room.status !== 'HIDING') return;

    this.stateMachine.transition(room, 'CHASE');
    this.broadcaster.broadcastGameState(room);

    const chaseTimer = setTimeout(() => {
      this.endChasePhase(roomId);
    }, room.settings.chaseSeconds * 1000);

    this.phaseTimers.set(`${roomId}-chase`, chaseTimer);
    logger.info('Chase phase started', { roomId });
  }

  private endChasePhase(roomId: string): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room || room.status !== 'CHASE') return;

    const result = this.winChecker.check(room);
    this.stateMachine.transition(room, 'END');
    this.broadcaster.broadcastGameEnd(room, result);

    this.battleZoneService.clearRoom(roomId);
    this.cleanupTimers(roomId);
    logger.info('Game ended', { roomId, winner: result.winner });
  }

  checkWinCondition(roomId: string): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room || (room.status !== 'CHASE' && room.status !== 'HIDING')) return;

    const players = Array.from(room.players.values());
    const thieves = players.filter(p => p.team === 'THIEF');
    const polices = players.filter(p => p.team === 'POLICE');

    // BATTLE 모드: 경찰 전원 탈락 시 도둑 승리
    if (room.settings.gameMode === 'BATTLE' && polices.length > 0) {
      const allPoliceOut = polices.every(p => !!(p as any).outOfZoneAt);
      if (allPoliceOut) {
        const result = this.winChecker.check(room);
        result.winner = 'THIEF';
        result.reason = '모든 경찰이 자기장 밖으로 탈락했습니다!';
        this.stateMachine.transition(room, 'END');
        this.broadcaster.broadcastGameEnd(room, result);
        this.cleanupTimers(roomId);
        logger.info('Thief win (all police eliminated)', { roomId });
        return;
      }
    }

    // 도둑이 없으면 경찰 승리
    if (thieves.length === 0) {
      const result = {
        winner: 'POLICE' as const,
        reason: '모든 도둑이 나갔습니다!',
        stats: {
          totalThieves: 0,
          capturedCount: 0,
          jailedCount: 0,
          survivedThieves: [],
          captureHistory: []
        }
      };
      this.stateMachine.transition(room, 'END');
      this.broadcaster.broadcastGameEnd(room, result);
      this.battleZoneService.clearRoom(roomId);
      this.cleanupTimers(roomId);
      logger.info('Police win (no thieves remaining)', { roomId });
      return;
    }

    // 모든 도둑이 검거/수감/자기장탈락 시 경찰 승리
    const allThievesOut = thieves.every(
      t =>
        t.thiefStatus?.state === 'CAPTURED' ||
        t.thiefStatus?.state === 'JAILED' ||
        t.thiefStatus?.state === 'OUT_OF_ZONE' ||
        !!(t as any).outOfZoneAt
    );

    if (allThievesOut && thieves.length > 0) {
      const result = this.winChecker.check(room);
      this.stateMachine.transition(room, 'END');
      this.broadcaster.broadcastGameEnd(room, result);
      this.battleZoneService.clearRoom(roomId);
      this.cleanupTimers(roomId);
      logger.info('Police win (all thieves captured/eliminated)', { roomId, totalThieves: thieves.length });
    }
  }

  /**
   * 플레이어 접속 해제 시 게임을 즉시 종료하고 모든 세션에 알립니다.
   * HIDING / CHASE 중에만 동작하며, 이미 END 상태면 무시합니다.
   */
  handlePlayerDisconnect(roomId: string, playerId: string): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return;
    if (room.status !== 'HIDING' && room.status !== 'CHASE') return;

    const player = room.players.get(playerId);
    const nickname = player?.nickname ?? '알 수 없음';

    // 현재 상태 기준으로 승패를 판정하되 reason만 덮어씀
    const result = this.winChecker.check(room);
    result.reason = `${nickname}님이 게임에서 나갔습니다. 게임이 종료됩니다.`;

    this.stateMachine.transition(room, 'END');
    this.broadcaster.broadcastGameEnd(room, result);
    this.battleZoneService.clearRoom(roomId);
    this.cleanupTimers(roomId);

    logger.info('Game force-ended (player disconnected)', { roomId, playerId, nickname });
  }

  private cleanupTimers(roomId: string): void {
    const hidingTimer = this.phaseTimers.get(`${roomId}-hiding`);
    const chaseTimer = this.phaseTimers.get(`${roomId}-chase`);

    if (hidingTimer) clearTimeout(hidingTimer);
    if (chaseTimer) clearTimeout(chaseTimer);

    this.phaseTimers.delete(`${roomId}-hiding`);
    this.phaseTimers.delete(`${roomId}-chase`);
  }
}
