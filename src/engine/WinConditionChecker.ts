import { Room } from '../types/room.types';
import { Player } from '../types/player.types';
import { GameResult, CaptureRecord } from '../types/game.types';

export class WinConditionChecker {
  check(room: Room): GameResult {
    const thieves = Array.from(room.players.values()).filter(p => p.team === 'THIEF');
    const totalThieves = thieves.length;
    const capturedOrJailed = thieves.filter(t => t.thiefStatus?.state === 'CAPTURED' || t.thiefStatus?.state === 'JAILED');
    const capturedOrJailedCount = capturedOrJailed.length;

    // 기본 룰: 모든 도둑을 "검거(캡처)"하거나 수감하면 경찰 승리
    if (capturedOrJailedCount === totalThieves && totalThieves > 0) {
      return {
        winner: 'POLICE',
        reason: '모든 도둑을 검거했습니다!',
        stats: this.buildStats(room, thieves)
      };
    }

    // 시간 종료 시점에 아직 FREE인 도둑이 1명이라도 있으면 도둑 승리
    const survivedThieves = thieves.filter(t => t.thiefStatus?.state === 'FREE');
    return {
      winner: 'THIEF',
      reason: `${survivedThieves.length}명의 도둑이 생존했습니다!`,
      stats: this.buildStats(room, thieves)
    };
  }

  private buildStats(room: Room, thieves: Player[]): GameResult['stats'] {
    const captureHistory: CaptureRecord[] = [];

    thieves.forEach(thief => {
      if (thief.thiefStatus && thief.thiefStatus.state !== 'FREE') {
        const police = room.players.get(thief.thiefStatus.capturedBy || '');
        captureHistory.push({
          thiefId: thief.playerId,
          thiefNickname: thief.nickname,
          policeId: police?.playerId || '',
          policeNickname: police?.nickname || '',
          capturedAt: thief.thiefStatus.capturedAt || 0,
          jailedAt: thief.thiefStatus.jailedAt || null
        });
      }
    });

    return {
      totalThieves: thieves.length,
      capturedCount: thieves.filter(t => t.thiefStatus?.state !== 'FREE').length,
      jailedCount: thieves.filter(t => t.thiefStatus?.state === 'JAILED').length,
      survivedThieves: thieves
        .filter(t => t.thiefStatus?.state !== 'JAILED')
        .map(t => t.playerId),
      captureHistory: captureHistory.sort((a, b) => a.capturedAt - b.capturedAt)
    };
  }
}
