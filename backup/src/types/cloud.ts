export interface AWSCredentials {
  AccessKeyId: string;
  SecretAccessKey: string;
  SessionToken?: string;
  Expiration?: string;
  Region: string;
  is_fallback?: boolean;
}

export interface AWSCloudSession {
  status: string;
  message: string;
  session_id: string;
  current_level: number;
  credentials: AWSCredentials;
  console_url: string;
  stack_info?: {
    stack_name: string;
    status: string;
    error?: string;
  };
}

export interface AWSLevelCheckResponse {
  status: 'correct' | 'incorrect';
  passed: boolean;
  feedback: string;
  level: number;
  next_level: number;
  points_awarded: number;
  total_score: number;
}

export interface CloudLevelInfo {
  level: number;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  points: number;
  shortDesc: string;
  objective: string;
  remediationHint: string;
  awsServices: string[];
}
