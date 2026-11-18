import { loadLecturerNotifications, openLecturerNotification, type NotificationPage, type MarkIssueNotificationTarget } from "./lecturerNotifications";
import { correctionError } from "./markCorrectionApi";

type Snapshot = { page: NotificationPage | null; loading: boolean; loadingMore: boolean; error: string; openingId: string | null; liveReady: boolean | null };
const defaultApi = { load: loadLecturerNotifications, open: openLecturerNotification };
/** One inbox per signed-in lecturer. No timer polling or academic persistence. */
export class LecturerNotificationStore {
  private state: Snapshot = { page: null, loading: true, loadingMore: false, error: "", openingId: null, liveReady: null };
  private listeners = new Set<() => void>();
  private flight: Promise<void> | null = null;
  private moreFlight: Promise<void> | null = null;
  private openFlight: Promise<MarkIssueNotificationTarget> | null = null;
  private revision = 0;
  private lastLoaded = 0;
  private invalidated = false;
  private active = true;
  constructor(private api = defaultApi, private now = () => Date.now()) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(patch: Partial<Snapshot>) { if (!this.active) return; this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  liveStatus = (ready: boolean) => { this.set({ liveReady: ready }); };
  dispose() { this.active = false; this.listeners.clear(); }
  refresh = (force = false): Promise<void> => {
    if (!this.active) return Promise.resolve();
    if (this.flight) return this.flight;
    if (!force && this.lastLoaded && this.now() - this.lastLoaded < 30000) return Promise.resolve();
    this.revision++;
    this.set({ loading: true, error: "" });
    const flight = (async () => {
      do {
        this.invalidated = false;
        const revision = this.revision;
        try {
          const page = await this.api.load();
          if (revision === this.revision) { this.set({ page, error: "" }); this.lastLoaded = this.now(); }
          else this.invalidated = true;
        } catch (reason) { this.set({ error: correctionError(reason, "Unable to load notifications. Try again.") }); }
      } while (this.active && this.invalidated);
    })().finally(() => { if (this.flight === flight) this.flight = null; this.set({ loading: false }); });
    this.flight = flight;
    return flight;
  };
  incoming = () => {
    // A burst is debounced by the provider; an insert during a read requests one
    // follow-up so a snapshot taken before that insert cannot lose the alert.
    this.invalidated = true;
    this.lastLoaded = 0;
    return this.refresh(true);
  };
  externalRead = (id: string, readAt: string) => {
    const page = this.state.page;
    const item = page?.items.find(item => item.id === id);
    if (!page || !item) { void this.incoming(); return; }
    if (item.read_at) return;
    this.revision++;
    this.set({ page: { ...page, unread_count: Math.max(0, page.unread_count - 1), items: page.items.map(row => row.id === id ? { ...row, read_at: readAt } : row) } });
  };
  loadMore = (): Promise<void> => {
    if (this.moreFlight) return this.moreFlight;
    const page = this.state.page;
    if (!page?.has_more || this.state.loading) return Promise.resolve();
    const revision = this.revision;
    this.set({ loadingMore: true, error: "" });
    const flight = this.api.load(page.items[page.items.length - 1]).then(next => {
      if (revision !== this.revision || this.state.loading) return;
      const ids = new Set(page.items.map(item => item.id));
      this.set({ page: { ...next, items: [...page.items, ...next.items.filter(item => !ids.has(item.id))] } });
    }).catch(reason => this.set({ error: correctionError(reason, "Unable to load older notifications. Try again.") }))
      .finally(() => { if (this.moreFlight === flight) this.moreFlight = null; this.set({ loadingMore: false }); });
    this.moreFlight = flight;
    return flight;
  };
  open = (id: string): Promise<MarkIssueNotificationTarget> => {
    if (this.openFlight) return this.state.openingId === id ? this.openFlight : Promise.reject(new Error("A notification is already opening."));
    this.revision++;
    this.set({ openingId: id, error: "" });
    const flight = this.api.open(id).then(target => {
      this.revision++;
      const page = this.state.page;
      if (page) this.set({ page: { ...page, unread_count: target.unreadCount, items: page.items.map(item => item.id === id ? { ...item, read_at: target.readAt } : item) } });
      else { this.lastLoaded = 0; void this.incoming(); }
      return target;
    }).catch(reason => { this.set({ error: correctionError(reason, "Unable to open this notification. Try again.") }); throw reason; })
      .finally(() => { if (this.openFlight === flight) this.openFlight = null; this.set({ openingId: null }); });
    this.openFlight = flight;
    return flight;
  };
}
