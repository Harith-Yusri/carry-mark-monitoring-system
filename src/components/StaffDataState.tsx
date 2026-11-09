import React from "react";
import "../styles/staff-loading.css";

type SkeletonLayout = "cards" | "table" | "metrics";

/** Only placeholders: never give an unknown count or release state a value. */
export function LoadingState({ label = "Loading section…", layout = "cards" }: { label?: string; layout?: SkeletonLayout }) {
  return <div role="status" aria-live="polite" aria-busy="true" className="staff-loading">
    <p className="staff-loading-label">{label}</p>
    <div aria-hidden="true" className={`staff-skeleton-${layout}`}>
      {Array.from({ length: layout === "table" ? 5 : 3 }, (_, index) => <div key={index} className="staff-skeleton-item">
        <span className="staff-skeleton-block staff-skeleton-short" />
        <span className="staff-skeleton-block" />
        <span className="staff-skeleton-block staff-skeleton-medium" />
      </div>)}
    </div>
  </div>;
}

/** Keep the screen heading visible while its first response is unknown/failed. */
export function InitialDataState({ title, label, error, layout = "cards", onRetry }: {
  title: string; label: string; error?: string; layout?: SkeletonLayout; onRetry?: () => void;
}) {
  return <section className="staff-initial-data-state">
    <h1 className="staff-data-heading">{title}</h1>
    {error ? <div role="alert" className="staff-data-error"><p>{error}</p>
      {onRetry && <button type="button" className="staff-primary-action staff-data-retry" onClick={onRetry}>Try again</button>}
    </div> : <LoadingState label={label} layout={layout} />}
  </section>;
}

export function RefreshStatus({ label = "Refreshing…" }: { label?: string }) {
  return <p role="status" className="staff-refresh-status">{label}</p>;
}
