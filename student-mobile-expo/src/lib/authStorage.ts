import * as SecureStore from "expo-secure-store";
import { startupError, startupLog } from "@/lib/startupLog";

const PERSISTENCE_KEY = "cmms-auth-persistence";
const ACTIVITY_KEY = "cmms-auth-last-activity";
const CHUNK_SIZE = 1800;
const MAX_CHUNKS = 32;
const SECURE_STORE_TIMEOUT_MS = 4000;
const memory = new Map<string, string>();
let persistenceEnabled: boolean | null = null;
let lastSessionKey: string | null = null;

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
    startupError(`SecureStore read failed (${key}); using memory fallback`, reason);
    return null;
  }
}

async function secureDelete(key: string) {
  try {
    await withTimeout(SecureStore.deleteItemAsync(key), `SecureStore delete (${key})`);
  } catch (reason) {
    if (__DEV__) console.warn("[Auth storage] SecureStore cleanup failed.", reason);
  }
}

async function secureSet(key: string, value: string) {
  try {
    await withTimeout(SecureStore.setItemAsync(key, value), `SecureStore write (${key})`);
    return true;
  } catch (reason) {
    if (__DEV__) console.warn("[Auth storage] SecureStore write failed; keeping the session in memory only.", reason);
    return false;
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

async function deleteSecureValue(key: string) {
  const base = safeKey(key);
  const rawCount = await secureGet(`${base}.chunks`);
  const count = Number(rawCount ?? 0);
  await Promise.all([
    secureDelete(base),
    secureDelete(`${base}.chunks`),
    ...Array.from({ length: Number.isInteger(count) && count > 0 && count <= MAX_CHUNKS ? count : 0 }, (_, index) =>
      secureDelete(`${base}.${index}`)),
  ]);
}

async function readSecureValue(key: string) {
  const base = safeKey(key);
  const rawCount = await secureGet(`${base}.chunks`);
  if (!rawCount) return secureGet(base);
  const count = Number(rawCount);
  if (!Number.isInteger(count) || count < 1 || count > MAX_CHUNKS) return null;
  const chunks = await Promise.all(
    Array.from({ length: count }, (_, index) => secureGet(`${base}.${index}`)),
  );
  return chunks.some(chunk => chunk === null) ? null : chunks.join("");
}

async function writeSecureValue(key: string, value: string) {
  await deleteSecureValue(key);
  const base = safeKey(key);
  const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "gs")) ?? [""];
  const writes = await Promise.all(chunks.map((chunk, index) => secureSet(`${base}.${index}`, chunk)));
  if (writes.some(written => !written)) return false;
  return secureSet(`${base}.chunks`, String(chunks.length));
}

export const authStorage = {
  async getItem(key: string) {
    lastSessionKey = key;
    if (!(await isPersistenceEnabled())) return memory.get(key) ?? null;
    const value = await readSecureValue(key);
    if (value) memory.set(key, value);
    return value;
  },
  async setItem(key: string, value: string) {
    lastSessionKey = key;
    memory.set(key, value);
    if (await isPersistenceEnabled() && !(await writeSecureValue(key, value))) persistenceEnabled = false;
  },
  async removeItem(key: string) {
    lastSessionKey = key;
    memory.delete(key);
    await deleteSecureValue(key);
  },
};

export async function setSessionPersistence(enabled: boolean) {
  if (enabled) {
    persistenceEnabled = await secureSet(PERSISTENCE_KEY, "true");
  } else {
    persistenceEnabled = false;
    await secureDelete(PERSISTENCE_KEY);
    await secureDelete(ACTIVITY_KEY);
    if (lastSessionKey) await deleteSecureValue(lastSessionKey);
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
  const lastActivity = Number(raw);
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return !Number.isFinite(lastActivity) || Date.now() < lastActivity || Date.now() - lastActivity >= sevenDays;
}

export async function clearStoredAuth() {
  memory.clear();
  await setSessionPersistence(false);
}
