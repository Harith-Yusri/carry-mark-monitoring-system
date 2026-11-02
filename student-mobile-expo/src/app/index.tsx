import { Redirect } from "expo-router";
import { useEffect } from "react";
import { LoadingView } from "@/components/ui";
import { useStudent } from "@/context/StudentContext";
import { startupLog } from "@/lib/startupLog";

export default function Index() {
  const { initializing, student, onboarding } = useStudent();
  useEffect(() => {
    startupLog(initializing ? "Index route waiting for startup" : `Index route redirecting to ${student ? "home" : onboarding ? "onboarding" : "login"}`);
  }, [initializing, onboarding, student]);
  if (initializing) return <LoadingView />;
  if (student) return <Redirect href="/(tabs)" />;
  if (onboarding) return <Redirect href="/onboarding" />;
  return <Redirect href="/login" />;
}
