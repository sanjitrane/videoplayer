export type PlayerErrorType =
  | "network"
  | "media"
  | "source"
  | "decode"
  | "timeout"
  | "unknown";

export type PlayerErrorSeverity = "warning" | "recoverable" | "fatal";

export type RecoveryAction = "retry" | "reload" | "reset" | "none";

export interface PlayerError {
  type: PlayerErrorType;
  severity: PlayerErrorSeverity;
  code?: number;
  message: string;
  timestamp: number;
  originalError?: unknown;
}

export interface RecoveryConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  maxRetryDelay: number;
}

export interface RecoveryStatus {
  isRecovering: boolean;
  retryCount: number;
  maxRetries: number;
  lastError?: PlayerError;
  lastRecoveryAction?: RecoveryAction;
  lastRecoveryTime?: number;
  outcome: RecoveryOutcome;
  lastRecoveryFailure?: string;
}

export type RecoveryOutcome =
  | "idle"
  | "recovering"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "exhausted";
