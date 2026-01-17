import { Player } from '../types/player.types';

export class TeamAssigner {
  assign(players: Player[]): { police: Player[]; thieves: Player[] } {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const totalPlayers = shuffled.length;
    // 홀수일 때 도둑이 1명 더 많도록 임시 규칙 적용
    const policeCount = Math.floor(totalPlayers / 2);

    const police = shuffled.slice(0, policeCount);
    const thieves = shuffled.slice(policeCount);

    return { police, thieves };
  }
}
