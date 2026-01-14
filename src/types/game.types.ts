import { Team } from './player.types';

export interface CaptureRecord {
  thiefId: string;
  thiefNickname: string;
  policeId: string;
  policeNickname: string;
  capturedAt: number;
  jailedAt: number | null;
}

export interface GameResult {
  winner: Team;
  reason: string;
  stats: {
    totalThieves: number;
    capturedCount: number;
    jailedCount: number;
    survivedThieves: string[];
    captureHistory: CaptureRecord[];
  };
}

export interface ValidationResult {
  valid: boolean;
  distance: number;
  error?: string;
}
