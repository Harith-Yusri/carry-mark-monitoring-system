import type { ClassSectionSummary, loadSubjectClassDetail } from "./carryMarkApi";

type Detail = Awaited<ReturnType<typeof loadSubjectClassDetail>>;
type Entry<T> = { value?: T; loadedAt: number; flight?: Promise<T> };
const MAX_AGE_MS = 30_000;

/** One Subject Hub instance only: never persisted or shared across users/hubs. */
export class SubjectClassCache {
  private summaries = new Map<string, Entry<ClassSectionSummary[]>>();
  private details = new Map<string, Entry<Detail>>();
  private writes = new Map<string, Promise<void>>();
  private flushers = new Map<string, () => Promise<void>>();
  private async read<T>(map: Map<string, Entry<T>>, key: string, fetch: () => Promise<T>) {
    const existing = map.get(key);
    if (existing?.flight) return existing.flight;
    if (existing?.value !== undefined && Date.now() - existing.loadedAt < MAX_AGE_MS) return existing.value;
    const entry: Entry<T> = { loadedAt: 0 };
    map.set(key, entry);
    entry.flight = fetch().then(value => {
      // Invalidation during an in-flight read must not put stale data back.
      if (map.get(key) === entry) { entry.value = value; entry.loadedAt = Date.now(); }
      return value;
    }).catch(error => { if (map.get(key) === entry) map.delete(key); throw error; })
      .finally(() => { entry.flight = undefined; });
    return entry.flight;
  }
  readSummaries(key: string, fetch: () => Promise<ClassSectionSummary[]>) { return this.read(this.summaries, key, fetch); }
  async readDetail(sectionId: string, fetch: () => Promise<Detail>) {
    await this.flushers.get(sectionId)?.();
    await this.writes.get(sectionId);
    return this.read(this.details, sectionId, fetch);
  }
  setFlusher(sectionId: string, flush: () => Promise<void>) {
    this.flushers.set(sectionId, flush);
    return () => { if (this.flushers.get(sectionId) === flush) this.flushers.delete(sectionId); };
  }
  async write(sectionId: string, operation: () => Promise<void>) {
    this.invalidateDetail(sectionId);
    const previous = this.writes.get(sectionId);
    const flight = (previous ?? Promise.resolve()).then(operation);
    this.writes.set(sectionId, flight);
    try { await flight; }
    finally { this.invalidateDetail(sectionId); if (this.writes.get(sectionId) === flight) this.writes.delete(sectionId); }
  }
  invalidateDetail(sectionId: string) { this.details.delete(sectionId); }
  invalidate(sectionId?: string) {
    this.summaries.clear();
    if (sectionId) this.details.delete(sectionId); else this.details.clear();
  }
}
