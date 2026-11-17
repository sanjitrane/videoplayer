import type { RecoveryStatus } from "../../types/errors.types";

interface Props {
  recoveryStatus: RecoveryStatus;
}

export const RecoverySection = ({ recoveryStatus }: Props) => {
  const {
    isRecovering,
    retryCount,
    maxRetries,
    lastError,
    lastRecoveryAction,
    lastRecoveryTime,
    lastRecoveryFailure,
  } = recoveryStatus;

  const recoveryState = {
    idle: "No recovery required",
    recovering: "Recovering",
    succeeded: "Recovered",
    failed: "Recovery failed",
    cancelled: "Recovery cancelled",
    exhausted: "Retries exhausted",
  }[recoveryStatus.outcome];

  const statusClass = {
    idle: "recovery-neutral",
    recovering: "recovery-warning",
    succeeded: "recovery-success",
    failed: "recovery-error",
    cancelled: "recovery-neutral",
    exhausted: "recovery-error",
  }[recoveryStatus.outcome];

  return (
    <section className="recovery-section">
      <div className="recovery-header">
        <h3>Playback Recovery</h3>
        <span className={`recovery-status ${statusClass}`}>
          {recoveryState}
        </span>
      </div>
      <div className="recovery-grid">
        <div>
          <span>Recovery attempts</span>
          <strong>
            {retryCount} / {maxRetries}
          </strong>
        </div>
        <div>
          <span>Last recovery action</span>
          <strong>{lastRecoveryAction ?? "-"}</strong>
        </div>
        <div>
          <span>Last Error</span>
          <strong>{lastError?.message ?? "-"}</strong>
        </div>
        <div>
          <span>Last successful recovery</span>
          <strong>
            {lastRecoveryTime
              ? new Date(lastRecoveryTime).toLocaleTimeString()
              : "-"}
          </strong>
        </div>
        <div>
          <span>Recovery failure</span>
          <strong>{lastRecoveryFailure ?? "-"}</strong>
        </div>
      </div>
    </section>
  );
};
