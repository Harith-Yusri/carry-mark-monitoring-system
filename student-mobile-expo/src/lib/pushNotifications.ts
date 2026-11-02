import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { router } from "expo-router";
import { registerPushDevice, unregisterPushDevice } from "@/services/studentApi";

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

export async function registerForStudentPushNotifications() {
  if (!Device.isDevice || (Platform.OS !== "android" && Platform.OS !== "ios")) return null;
  await configureAndroidChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return null;

  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("The EAS project ID required for push notifications is missing.");
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerPushDevice(await installationId(), token.data, Platform.OS);
  return token.data;
}

export async function unregisterCurrentPushInstallation() {
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
  return Notifications.addPushTokenListener(() => {
    void registerForStudentPushNotifications().catch(onError);
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
