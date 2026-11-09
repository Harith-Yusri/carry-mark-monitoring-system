import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { router } from "expo-router";
import { getPushRegistrationAccount, registerPushDevice, unregisterPushDevice } from "@/services/studentApi";

const REGISTRATION_KEY = "cams.push.registration-v1";
const REGISTRATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
let registrationGeneration = 0;
let registrationTail: Promise<unknown> = Promise.resolve();
const registrationFlights = new Map<string, Promise<string | null>>();

const INSTALLATION_KEY = "cams.push.installation-id";
export const MARKS_RELEASED_CHANNEL = "marks-released";
const handledResponses = new Set<string>();

async function installationId() {
  const stored = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (stored) return stored;
  const random = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join("");
  const created = `cams-${Date.now().toString(36)}-${random}`;
  await SecureStore.setItemAsync(INSTALLATION_KEY, created);
  return created;
}

async function configureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(MARKS_RELEASED_CHANNEL, {
    name: "Marks released",
    description: "Continuous assessment mark-release alerts from CAMS",
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 180, 250],
    lightColor: "#8B3FA0",
    // Omit sound to use Android's system default. Explicit strings here are
    // treated as bundled custom sound filenames by the channel API.
  });
}

type RegisteredDevice = { account: string; installation: string; token: string; platform: string; confirmedAt: number };

export function registerForStudentPushNotifications(devicePushToken?: Notifications.DevicePushToken) {
  // Native token-change callbacks must reuse the supplied token. Asking the SDK
  // to fetch it again can trigger that callback recursively (Expo SDK 58).
  const key = devicePushToken ? `${devicePushToken.type}:${JSON.stringify(devicePushToken.data)}` : "startup";
  const existing = registrationFlights.get(key);
  if (existing) return existing;
  const generation = registrationGeneration;
  const work = registrationTail.catch(() => undefined).then(() => registerDevice(devicePushToken, generation));
  registrationFlights.set(key, work);
  registrationTail = work;
  void work.finally(() => { if (registrationFlights.get(key) === work) registrationFlights.delete(key); }).catch(() => undefined);
  return work;
}

async function registerDevice(devicePushToken: Notifications.DevicePushToken | undefined, generation: number) {
  if (!Device.isDevice || (Platform.OS !== "android" && Platform.OS !== "ios")) return null;
  if (generation !== registrationGeneration) return null;
  const account = await getPushRegistrationAccount();
  await configureAndroidChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return null;
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("The EAS project ID required for push notifications is missing.");
  const token = await Notifications.getExpoPushTokenAsync({ projectId, ...(devicePushToken ? { devicePushToken } : {}) });
  const installation = await installationId();
  if (generation !== registrationGeneration || account !== await getPushRegistrationAccount()) return null;
  let confirmed: RegisteredDevice | null = null;
  try { confirmed = JSON.parse(await SecureStore.getItemAsync(REGISTRATION_KEY) ?? "null"); } catch { /* A missing/corrupt cache must never block repair. */ }
  const unchanged = confirmed?.account === account && confirmed?.installation === installation
    && confirmed?.token === token.data && confirmed?.platform === Platform.OS
    && Date.now() >= confirmed.confirmedAt && Date.now() - confirmed.confirmedAt < REGISTRATION_MAX_AGE_MS;
  if (!unchanged) {
    await registerPushDevice(installation, token.data, Platform.OS);
    // A concurrent sign-out invalidates this result before it can be cached.
    if (generation === registrationGeneration && account === await getPushRegistrationAccount()) {
      const value: RegisteredDevice = { account, installation, token: token.data, platform: Platform.OS, confirmedAt: Date.now() };
      await SecureStore.setItemAsync(REGISTRATION_KEY, JSON.stringify(value));
    }
  }
  return token.data;
}

/** Preference changes invalidate the success cache; disabled accounts do not register. */
export async function invalidatePushRegistration() {
  registrationGeneration++;
  await SecureStore.deleteItemAsync(REGISTRATION_KEY);
}

export async function unregisterCurrentPushInstallation() {
  await invalidatePushRegistration();
  // Finish any already-started registration before deactivating this installation.
  await registrationTail.catch(() => undefined);
  const stored = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (stored) await unregisterPushDevice(stored);
}

async function openNotification(response: Notifications.NotificationResponse, refresh: () => Promise<boolean>) {
  const responseId = response.notification.request.identifier;
  if (handledResponses.has(responseId)) return;
  handledResponses.add(responseId);
  const data = response.notification.request.content.data;
  const offeringId = typeof data?.offeringId === "string" ? data.offeringId : null;
  if (!(await refresh())) {
    handledResponses.delete(responseId);
    return;
  }
  if (offeringId && /^[0-9a-f-]{36}$/i.test(offeringId)) {
    router.push({ pathname: "/subject/[offeringId]", params: { offeringId } });
  } else if (data?.route === "/progress") {
    router.push("/(tabs)/progress");
  }
}

export function listenForPushTokenChanges(onError: (reason: unknown) => void) {
  return Notifications.addPushTokenListener(token => {
    void registerForStudentPushNotifications(token).catch(onError);
  });
}

export function listenForNotificationResponses(refresh: () => Promise<boolean>) {
  const handle = async (response: Notifications.NotificationResponse) => {
    await openNotification(response, refresh);
    await Notifications.clearLastNotificationResponseAsync();
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    void handle(response).catch(reason => {
      if (__DEV__) console.warn("[CAMS Push] Notification refresh/navigation failed", reason);
    });
  });
  void Notifications.getLastNotificationResponseAsync().then(response => {
    if (!response) return;
    return handle(response);
  }).catch(() => undefined);
  return subscription;
}

export { configureAndroidChannel };
