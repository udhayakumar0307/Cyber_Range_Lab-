export type CtfCategory = 'Web' | 'Pwn' | 'Reverse' | 'Crypto' | 'Forensics' | 'OSINT' | 'Misc';
export type CtfEventMode = 'individual' | 'team';
export type CtfScoringType = 'static' | 'dynamic';
export type CtfEventStatus = 'upcoming' | 'live' | 'paused' | 'concluded';

export interface CtfHint {
  id: string;
  text: string;
  cost: number;
  unlocked: boolean;
}

export interface CtfChallenge {
  id: string;
  eventId: string;
  title: string;
  category: CtfCategory;
  description: string;
  basePoints: number;
  minPoints: number;
  decayRate: number; // Solves count multiplier for point reduction
  currentPoints: number;
  flag: string; // Exact match or regex pattern
  fileUrls?: { name: string; url: string }[];
  hints: CtfHint[];
  solveCount: number;
  isSolved?: boolean;
}

export interface CtfPrize {
  rank: number;
  title: string;
  reward: string;
}

export interface CtfEvent {
  id: string;
  title: string;
  description: string;
  bannerUrl?: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  mode: CtfEventMode;
  scoringType: CtfScoringType;
  status: CtfEventStatus;
  maxTeamSize?: number;
  rateLimitAttempts?: number;
  rulesMarkdown?: string;
  prizes?: CtfPrize[];
  extendedMinutes?: number;
  isFrozen: boolean;
  freezeTime?: string;
  isPublic: boolean;
  totalChallenges: number;
  totalSolves: number;
  participantCount: number;
}

export interface CtfTeam {
  id: string;
  name: string;
  inviteCode: string;
  captainName: string;
  members: string[];
  totalPoints: number;
  rank: number;
  solves: string[]; // Challenge IDs
}

export interface CtfSubmission {
  id: string;
  challengeId: string;
  challengeTitle: string;
  teamOrUserName: string;
  timestamp: string;
  isCorrect: boolean;
  flagSubmitted: string;
  pointsEarned: number;
}

export interface CtfScoreboardEntry {
  rank: number;
  name: string;
  teamId?: string;
  isUserTeam?: boolean;
  totalPoints: number;
  lastSolveTime: string;
  solvesByCategory: Partial<Record<CtfCategory, number>>;
  solveHistory: { timestamp: string; points: number }[];
}

export interface CtfAnnouncement {
  id: string;
  title: string;
  content: string;
  timestamp: string;
}
