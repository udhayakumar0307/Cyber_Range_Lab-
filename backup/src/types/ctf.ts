export type CtfCategory = 'Web' | 'Pwn' | 'Reverse' | 'Crypto' | 'Forensics' | 'OSINT' | 'Misc';
export type CtfEventMode = 'individual' | 'team';
export type CtfScoringType = 'static' | 'dynamic';
export type CtfEventStatus = 'upcoming' | 'live' | 'paused' | 'concluded' | 'scheduled' | 'active' | 'completed';

export interface CtfHint {
  id: any;
  order_index?: number;
  cost_percent?: number;
  text?: string;
  cost: number; // legacy
  unlocked: boolean; // legacy
}

export interface CtfChallengeFile {
  id: number;
  filename: string;
  mime_type?: string;
  file_size_bytes: number;
  uploaded_at: string;
}

export interface CtfChallenge {
  id: any;
  ctf_id?: number;
  eventId?: string; // legacy
  title: string;
  category: CtfCategory;
  description: string;
  connection_string?: string;
  challenge_url?: string;
  scoring_mode?: 'static' | 'dynamic'; // optional
  static_points?: number;
  dynamic_ceiling?: number;
  dynamic_floor?: number;
  decay_constant?: number;
  is_hidden?: boolean; // optional
  url_active?: boolean; // optional
  solve_count?: number; // optional
  current_points?: number;
  files?: CtfChallengeFile[];
  hints: CtfHint[];
  
  // legacy mock compatibility:
  basePoints?: number;
  minPoints?: number;
  decayRate?: number;
  currentPoints: number;
  flag?: string;
  fileUrls?: { name: string; url: string }[];
  solveCount: number;
  isSolved?: boolean;
}

export interface CtfPrize {
  rank: number;
  title: string;
  reward: string;
}

export interface CtfEvent {
  id: any;
  title: string;
  description: string;
  start_time?: string; // backend
  end_time?: string;   // backend
  startTime: string;  // legacy
  endTime: string;    // legacy
  status: CtfEventStatus;
  is_frozen?: boolean; // backend
  is_public?: boolean; // backend
  created_at?: string; // backend

  // legacy mock compatibility:
  bannerUrl?: string;
  mode: CtfEventMode;
  scoringType: CtfScoringType;
  maxTeamSize?: number;
  rateLimitAttempts?: number;
  rulesMarkdown?: string;
  prizes?: CtfPrize[];
  extendedMinutes?: number;
  isFrozen: boolean;
  freezeTime?: string;
  isPublic: boolean;
  totalChallenges: number;
  totalSolves?: number;
  participantCount?: number;
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
  id: any;
  challenge_id?: number;
  challengeId?: string; // legacy
  challengeTitle?: string;
  participant_id?: number;
  participant_name?: string;
  teamOrUserName?: string; // legacy
  timestamp?: string; // legacy
  submitted_at?: string;
  is_correct?: boolean;
  isCorrect?: boolean; // legacy
  is_first_blood?: boolean;
  submitted_flag_hash?: string;
  flagSubmitted?: string; // legacy
  points_credited?: number;
  pointsEarned?: number; // legacy
  hint_penalty_percent?: number;
}

export interface CtfScoreboardEntry {
  rank: number;
  name?: string; // legacy
  participant_id?: number;
  participant_name?: string;
  teamId?: string;
  isUserTeam?: boolean;
  totalPoints?: number; // legacy
  total_points?: number;
  lastSolveTime?: string; // legacy
  last_submission_at?: string;
  solve_count?: number;
  first_blood_challenges?: number[];
  solvesByCategory: Partial<Record<CtfCategory, number>>;
  solveHistory?: { timestamp: string; points: number }[];
}

export interface CtfAnnouncement {
  id: string;
  title: string;
  content: string;
  timestamp: string;
}
