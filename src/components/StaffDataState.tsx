import { t, tx, useLocale } from "../localization/react";
import React from "react";
import "../styles/staff-loading.css";

type SkeletonLayout = "cards" | "table" | "metrics";

/** Only placeholders: never give an unknown count or release state a value. */
export function LoadingState({ label = "Loading section…", layout = "cards" }: { label?: string; layout?: SkeletonLayout }) {
  useLocale();
  return <div role="status" aria-live="polite" aria-busy="true" className="staff-loading">
    <p className="staff-loading-label">{tx(label)}</p>
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
  useLocale();
  return <section className="staff-initial-data-state">
    <h1 className="staff-data-heading">{tx(title)}</h1>
    {error ? <div role="alert" className="staff-data-error"><p>{tx(error)}</p>
      {onRetry && <button type="button" className="staff-primary-action staff-data-retry" onClick={onRetry}>{t("Try again")}</button>}
    </div> : <LoadingState label={label} layout={layout} />}
  </section>;
}

export function RefreshStatus({ label = "Refreshing…" }: { label?: string }) {
  useLocale();
  return <p role="status" className="staff-refresh-status">{tx(label)}</p>;
}
