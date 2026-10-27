import { Redirect } from "expo-router";
import { useEffect } from "react";
import { LoadingView } from "@/components/ui";
import { useStudent } from "@/context/StudentContext";
import { startupLog } from "@/lib/startupLog";

export default function Index() {
  const { initializing, student } = useStudent();
  useEffect(() => {
    startupLog(initializing ? "Index route rendered in loading state" : `Index route redirecting to ${student ? "home" : "login"}`);
  }, [initializing, student]);
  if (initializing) return <LoadingView />;
  return <Redirect href={student ? "/(tabs)" : "/login"} />;
}
