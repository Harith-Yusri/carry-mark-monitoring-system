import * as SecureStore from "expo-secure-store";
import { startupError, startupLog } from "@/lib/startupLog";
import { sessionLog } from "@/lib/sessionDiagnostics";

const PERSISTENCE_KEY = "cmms-auth-persistence";
const ACTIVITY_KEY = "cmms-auth-last-activity";
const CHUNK_SIZE = 1800;
const MAX_CHUNKS = 32;
const SECURE_STORE_TIMEOUT_MS = 4000;
const memory = new Map<string, string>();
let persistenceEnabled: boolean | null = null;
const sessionKeys = new Set<string>();

function withTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), SECURE_STORE_TIMEOUT_MS);
    operation.then(
      value => { clearTimeout(timer); resolve(value); },
      reason => { clearTimeout(timer); reject(reason); },
    );
  });
}

async function secureGet(key: string) {
  startupLog(`SecureStore read started (${key})`);
  try {
    const value = await withTimeout(SecureStore.getItemAsync(key), `SecureStore read (${key})`);
    startupLog(`SecureStore read completed (${key})`);
    return value;
  } catch (reason) {
    startupError("SecureStore read failed; stored session retained", reason);
    throw new Error("Unable to read your saved sign-in securely. Please try again.");
  }
}

async function secureDelete(key: string) {
  try {
    await withTimeout(SecureStore.deleteItemAsync(key), `SecureStore delete (${key})`);
  } catch (reason) {
    if (__DEV__) console.warn("[Auth storage] SecureStore cleanup failed.", reason);
    throw new Error("Unable to clear saved sign-in securely. Please try again.");
  }
}

async function secureSet(key: string, value: string) {
  try {
    await withTimeout(SecureStore.setItemAsync(key, value), `SecureStore write (${key})`);
    return true;
  } catch (reason) {
    if (__DEV__) console.warn("[Auth storage] SecureStore write failed.", reason);
    throw new Error("Unable to save your sign-in securely. Please try again.");
  }
}

function safeKey(key: string) {
  return `cmms-${key.replace(/[^A-Za-z0-9._-]/g, "_")}`;
}

async function isPersistenceEnabled() {
  if (persistenceEnabled === null) {
    persistenceEnabled = (await secureGet(PERSISTENCE_KEY)) === "true";
  }
  return persistenceEnabled;
}

function chunkManifest(raw: string | null): { count: number; generation?: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const count = typeof parsed === "number" ? parsed : parsed.count;
    const generation = typeof parsed === "object" ? parsed.generation : undefined;
    if (!Number.isInteger(count) || count < 1 || count > MAX_CHUNKS) return null;
    if (generation !== undefined && (typeof generation !== "string" || !/^[a-z0-9-]+$/.test(generation))) return null;
    return { count, generation };
  } catch { return null; }
}

function chunkKeys(base: string, manifest: { count: number; generation?: string } | null) {
  return Array.from({ length: manifest?.count ?? 0 }, (_, index) =>
    `${base}.${manifest?.generation ? `${manifest.generation}.` : ""}${index}`);
}

async function deleteSecureValue(key: string) {
  const base = safeKey(key);
  const manifest = chunkManifest(await secureGet(`${base}.chunks`));
  await Promise.all([
    secureDelete(base),
    secureDelete(`${base}.chunks`),
    ...chunkKeys(base, manifest).map(secureDelete),
  ]);
}

async function readSecureValue(key: string) {
  const base = safeKey(key);
  const rawCount = await secureGet(`${base}.chunks`);
  if (!rawCount) return secureGet(base);
  const manifest = chunkManifest(rawCount);
  if (!manifest) throw new Error("Unable to read your saved sign-in securely. Please try again.");
  const chunks = await Promise.all(chunkKeys(base, manifest).map(secureGet));
  if (chunks.some(chunk => chunk === null)) throw new Error("Your saved sign-in is incomplete. Please sign out and sign in again.");
  return chunks.join("");
}

async function writeSecureValue(key: string, value: string) {
  const base = safeKey(key);
  const previous = chunkManifest(await secureGet(`${base}.chunks`));
  const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "gs")) ?? [""];
  if (chunks.length > MAX_CHUNKS) throw new Error("Unable to save your sign-in securely.");
  const next = { count: chunks.length, generation: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}` };
  const keys = chunkKeys(base, next);
  try {
    const writes = await Promise.allSettled(keys.map((chunkKey, index) => secureSet(chunkKey, chunks[index])));
    const failure = writes.find(result => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
    // Commit only after every new chunk is stored. A failed refresh write must
    // leave the previous saved session readable, including the legacy format.
    await secureSet(`${base}.chunks`, JSON.stringify(next));
  } catch (reason) {
    await Promise.allSettled(keys.map(secureDelete));
    throw reason;
  }
  void Promise.allSettled([secureDelete(base), ...chunkKeys(base, previous).map(secureDelete)]);
}

export const authStorage = {
  async getItem(key: string) {
    sessionKeys.add(key);
    if (!(await isPersistenceEnabled())) return memory.get(key) ?? null;
    const value = await readSecureValue(key);
    if (value) memory.set(key, value);
    if (value && key.endsWith("-auth-token")) sessionLog("stored session found");
    return value;
  },
  async setItem(key: string, value: string) {
    sessionKeys.add(key);
    if (await isPersistenceEnabled()) await writeSecureValue(key, value);
    memory.set(key, value);
  },
  async removeItem(key: string) {
    sessionKeys.add(key);
    memory.delete(key);
    await deleteSecureValue(key);
  },
};

export async function setSessionPersistence(enabled: boolean) {
  if (enabled) {
    persistenceEnabled = await secureSet(PERSISTENCE_KEY, "true");
  } else {
    // Persist a signed-out marker before cleanup, so an interrupted cleanup
    // cannot restore leftover tokens on the next launch.
    await secureSet(PERSISTENCE_KEY, "false");
    persistenceEnabled = false;
    const keys = new Set(sessionKeys);
    for (const key of sessionKeys) {
      const base = key.replace(/-(code-verifier|user)$/, "");
      keys.add(base);
      keys.add(`${base}-code-verifier`);
      keys.add(`${base}-user`);
    }
    const results = await Promise.allSettled([
      secureDelete(ACTIVITY_KEY),
      ...Array.from(keys, deleteSecureValue),
    ]);
    const failure = results.find(result => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }
}

export async function recordAuthActivity() {
  if (await isPersistenceEnabled()) {
    await secureSet(ACTIVITY_KEY, String(Date.now()));
  }
}

export async function hasExpiredPersistedSession() {
  if (!(await isPersistenceEnabled())) return false;
  const raw = await secureGet(ACTIVITY_KEY);
  // A missing legacy timestamp is not proof that a valid session expired.
  if (raw === null) return false;
  const lastActivity = Number(raw);
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return !Number.isFinite(lastActivity) || Date.now() < lastActivity || Date.now() - lastActivity >= sevenDays;
}

export async function clearStoredAuth() {
  memory.clear();
  await setSessionPersistence(false);
}
