const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const quiet = { startupLog() {}, startupError() {}, sessionLog() {}, logOAuthError() {} };

function load(relativePath, dependencies, globals = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, relativePath), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const context = { exports: {}, __DEV__: false, console, setTimeout, clearTimeout, AbortController,
    require(name) {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected dependency: ${name}`);
    }, ...globals };
  vm.runInNewContext(compiled, context, { filename: relativePath });
  return context.exports;
}

function storage(disk = new Map(), failure = {}) {
  return load("src/lib/authStorage.ts", {
    "expo-secure-store": {
      async getItemAsync(key) {
        if (failure.read) throw new Error("Device storage unavailable");
        return disk.get(key) ?? null;
      },
      async setItemAsync(key, value) {
        if (failure.write?.(key)) throw new Error("Device storage unavailable");
        disk.set(key, value);
      },
      async deleteItemAsync(key) { disk.delete(key); },
    },
    "@/lib/startupLog": quiet,
    "@/lib/sessionDiagnostics": quiet,
  });
}

const key = "sb-test-project-auth-token";

test("saved session and PKCE values survive a fresh JS runtime", async () => {
  const disk = new Map();
  const first = storage(disk);
  await first.setSessionPersistence(true);
  await first.authStorage.setItem(key, "test-session".repeat(500));
  await first.authStorage.setItem(`${key}-code-verifier`, "test-verifier");
  const restarted = storage(disk);
  assert.equal(await restarted.authStorage.getItem(key), "test-session".repeat(500));
  assert.equal(await restarted.authStorage.getItem(`${key}-code-verifier`), "test-verifier");
});

test("existing numeric chunk format remains readable", async () => {
  const base = `cmms-${key}`;
  const disk = new Map([["cmms-auth-persistence", "true"], [`${base}.chunks`, "2"],
    [`${base}.0`, "existing-"], [`${base}.1`, "session"]]);
  assert.equal(await storage(disk).authStorage.getItem(key), "existing-session");
});

test("failed session update retains the previous saved value", async () => {
  const disk = new Map(), failure = {};
  const first = storage(disk, failure);
  await first.setSessionPersistence(true);
  await first.authStorage.setItem(key, "previous-session");
  failure.write = chunkKey => chunkKey.startsWith(`cmms-${key}.`) && !chunkKey.endsWith(".chunks");
  await assert.rejects(first.authStorage.setItem(key, "new-session"), /Unable to save/);
  assert.equal(await storage(disk).authStorage.getItem(key), "previous-session");
});

test("manual sign-out clears session, verifier and user keys after restart", async () => {
  const disk = new Map(), first = storage(disk);
  await first.setSessionPersistence(true);
  for (const storedKey of [key, `${key}-code-verifier`, `${key}-user`]) {
    await first.authStorage.setItem(storedKey, "fixture");
  }
  await first.clearStoredAuth();
  const restarted = storage(disk);
  assert.equal(await restarted.authStorage.getItem(key), null);
  assert.equal([...disk.keys()].some(storedKey => storedKey.includes("sb-test-project")), false);
});

test("storage failures surface instead of pretending no saved session exists", async () => {
  await assert.rejects(storage(new Map(), { read: true }).authStorage.getItem(key), /Unable to read/);
  await assert.rejects(storage(new Map(), { write: () => true }).setSessionPersistence(true), /Unable to save/);
});

test("missing legacy activity timestamp does not expire a valid session; seven-day policy remains", async () => {
  const disk = new Map([["cmms-auth-persistence", "true"]]);
  assert.equal(await storage(disk).hasExpiredPersistedSession(), false);
  disk.set("cmms-auth-last-activity", String(Date.now() - 8 * 24 * 60 * 60 * 1000));
  assert.equal(await storage(disk).hasExpiredPersistedSession(), true);
});

function provider(providerName, bootstrapError = null) {
  const counters = { google: 0, demo: 0, signOut: 0, getSession: 0 };
  const payload = { student: { matrix_number: "fixture" }, subjects: [], notifications: [], notifications_enabled: true };
  const effects = [];
  let state, value, listener;
  const api = {
    demoModeEnabled: true,
    async loadStudentBootstrap() {
      counters.google++;
      if (bootstrapError) throw bootstrapError;
      return { onboarding: { profile_complete: true }, portal: payload };
    },
    async loadPortal() { counters.demo++; return payload; },
    async signOut() { counters.signOut++; },
  };
  const react = {
    createContext: () => ({ Provider() {} }),
    useState(initial) { state = initial; return [state, update => { state = typeof update === "function" ? update(state) : update; }]; },
    useRef: current => ({ current }),
    useCallback: callback => callback,
    useEffect: callback => effects.push(callback),
    useMemo: factory => (value = factory()),
  };
  const session = { user: { app_metadata: { provider: providerName, providers: [providerName] } } };
  const module = load("src/context/StudentContext.tsx", {
    react, "react/jsx-runtime": { jsx() {} },
    "react-native": { AppState: { addEventListener: () => ({ remove() {} }) } },
    "@/lib/errors": { friendlyError: () => "Unable to load", joinClassError: () => "Unable to join" },
    "@/lib/startupLog": quiet, "@/lib/sessionDiagnostics": quiet, "@/lib/oauthDiagnostics": quiet,
    "@/services/studentApi": api,
    "@/lib/supabase": { supabase: { auth: {
      async getSession() { counters.getSession++; return { data: { session }, error: null }; },
      onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    } } },
  });
  module.StudentProvider({ children: null });
  effects[0]();
  return { counters, value, state: () => state, recover: () => { bootstrapError = null; }, emit: event => listener(event) };
}

test("restored Google session uses Google bootstrap; restored demo uses existing portal", async () => {
  for (const name of ["google", "email"]) {
    const app = provider(name);
    assert.equal(await app.value.restoreSession(), true);
    assert.equal(app.counters.getSession, 1, "concurrent restoration joins one request");
    assert.equal(app.counters.google, name === "google" ? 1 : 0);
    assert.equal(app.counters.demo, name === "email" ? 1 : 0);
    assert.equal(app.state().student.matrix_number, "fixture");
    assert.equal(app.state().initializing, false);
  }
});

test("bootstrap failure retains auth and permits retry; SIGNED_OUT clears portal state", async () => {
  const app = provider("google", new Error("Network unavailable"));
  assert.equal(await app.value.restoreSession(), false);
  assert.equal(app.counters.signOut, 0);
  assert.equal(app.state().restoreFailed, true);
  assert.equal(app.state().initializing, false);
  app.recover();
  assert.equal(await app.value.restoreSession(), true);
  assert.equal(app.state().restoreFailed, false);
  app.emit("SIGNED_OUT");
  assert.equal(app.state().student, null);
});

test("Supabase restores and refreshes expired sessions through the secure adapter", async () => {
  const { createClient } = require("@supabase/supabase-js");
  const disk = new Map();
  const firstStorage = storage(disk);
  await firstStorage.setSessionPersistence(true);
  const user = { id: "00000000-0000-0000-0000-000000000001", email: "fixture@student.uitm.edu.my", app_metadata: { provider: "google" }, user_metadata: {} };
  const jwt = expiry => [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: user.id, exp: expiry })).toString("base64url"),
    Buffer.from("fixture-signature").toString("base64url"),
  ].join(".");
  const now = Math.floor(Date.now() / 1000);
  let refreshes = 0;
  const options = adapter => ({
    auth: { storage: adapter.authStorage, storageKey: key, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    global: { fetch: async url => {
      if (String(url).includes("/token")) {
        refreshes++;
        return Response.json({ access_token: jwt(now + 3600), refresh_token: "rotated-fixture", expires_in: 3600, token_type: "bearer", user });
      }
      return Response.json(user);
    } },
  });
  const first = createClient("https://fixture.supabase.co", "fixture-public-key", options(firstStorage));
  try {
    const result = await first.auth.setSession({ access_token: jwt(now + 3600), refresh_token: "fixture" });
    assert.equal(result.error, null);
    await first.auth.stopAutoRefresh();
    // Simulate time passing while the app is terminated.
    const persisted = JSON.parse(await firstStorage.authStorage.getItem(key));
    persisted.access_token = jwt(now - 60);
    persisted.expires_at = now - 60;
    await firstStorage.authStorage.setItem(key, JSON.stringify(persisted));
    const restarted = createClient("https://fixture.supabase.co", "fixture-public-key", options(storage(disk)));
    try {
      const restored = await restarted.auth.getSession();
      assert.equal(restored.error, null);
      assert.equal(restored.data.session.user.id, user.id);
      assert.equal(restored.data.session.refresh_token, "rotated-fixture");
      assert.equal(refreshes, 1);
      assert.equal(JSON.parse(await storage(disk).authStorage.getItem(key)).refresh_token, "rotated-fixture");
    } finally { await restarted.auth.stopAutoRefresh(); }
  } finally { await first.auth.stopAutoRefresh(); }
});
