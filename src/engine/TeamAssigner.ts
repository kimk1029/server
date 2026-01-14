import { Player } from '../types/player.types';

export class TeamAssigner {
  assign(players: Player[]): { police: Player[]; thieves: Player[] } {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const totalPlayers = shuffled.length;
    const policeCount = Math.ceil(totalPlayers / 2);

    const police = shuffled.slice(0, policeCount);
    const thieves = shuffled.slice(policeCount);

    return { police, thieves };
  }
}
