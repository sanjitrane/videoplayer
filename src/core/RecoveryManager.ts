import type {
  PlayerError,
  RecoveryConfig,
  RecoveryStatus,
  RecoveryAction,
  RecoveryOutcome,
} from "../types/errors.types";

const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  enabled: true,
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  maxRetryDelay: 10000,
};

export class RecoveryManager {
  private config: RecoveryConfig;
  private retryCount = 0;
  private isRecovering = false;
  private lastError?: PlayerError;
  private lastRecoveryAction?: RecoveryAction;
  private lastRecoveryTime?: number;
  private lastRecoveryfailure?: string;
  private outcome: RecoveryOutcome = "idle";

  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingResolve?: (result: boolean) => void;

  constructor(config?: Partial<RecoveryConfig>) {
    this.config = {
      ...DEFAULT_RECOVERY_CONFIG,
      ...config,
    };
  }

  getStatus(): RecoveryStatus {
    return {
      isRecovering: this.isRecovering,
      retryCount: this.retryCount,
      maxRetries: this.config.maxRetries,
      lastError: this.lastError,
      lastRecoveryAction: this.lastRecoveryAction,
      lastRecoveryTime: this.lastRecoveryTime,
      outcome: this.outcome,
      lastRecoveryFailure: this.lastRecoveryfailure,
    };
  }

  async execute(
    error: PlayerError,
    action: RecoveryAction,
    recoveryCallback: () => Promise<void>,
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    if (error.severity !== "recoverable" || action == "none") {
      return false;
    }

    if (this.isRecovering) {
      return false;
    }

    if (this.retryCount >= this.config.maxRetries) {
      this.outcome = "exhausted";
      return false;
    }

    this.retryCount++;
    this.isRecovering = true;
    this.lastError = error;
    this.lastRecoveryAction = action;
    this.outcome = "recovering";
    this.lastRecoveryfailure = undefined;

    const delay = Math.min(
      this.config.retryDelay *
        Math.pow(this.config.backoffMultiplier, this.retryCount - 1),
      this.config.maxRetryDelay,
    );

    try {
      const shouldContinue = await this.wait(delay);
      if (!shouldContinue) {
        return false;
      }
      await recoveryCallback();
      this.lastRecoveryTime = Date.now();
      this.outcome = "succeeded";
      return true;
    } catch (error) {
      const failure = error instanceof Error ? error.message : String(error);
      this.lastRecoveryfailure = failure;
      this.outcome =
        this.retryCount >= this.config.maxRetries ? "exhausted" : "failed";

      console.error("Playback recovery failed:", error);

      return false;
    } finally {
      this.isRecovering = false;
    }
  }

  reset(): void {
    this.stop();
    this.retryCount = 0;
    this.isRecovering = false;
    this.lastError = undefined;
    this.lastRecoveryAction = undefined;
    this.lastRecoveryTime = undefined;
    this.lastRecoveryfailure = undefined;
    this.outcome = "idle";
  }

  stop(): void {
    if (this.retryTimer !== null) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.pendingResolve) {
      this.outcome = "cancelled";
      this.pendingResolve?.(false);
      this.pendingResolve = undefined;
    }
  }

  private wait(delay: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.pendingResolve = undefined;
        resolve(true);
      }, delay);
    });
  }
}
