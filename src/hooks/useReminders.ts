import { useRef, useState } from "react";
import { requireSupabase } from "../lib/supabase";

export function useReminders() {
  const inFlight = useRef(new Set<string>());
  const [sendingReminders, setSending] = useState(new Set<string>());
  const [sentReminders, setSent] = useState(new Set<string>());
  const [reminderError, setError] = useState("");

  const sendReminder = async (staffNo: string) => {
    if (inFlight.current.has(staffNo)) return;
    inFlight.current.add(staffNo);
    setSending(new Set(inFlight.current));
    setError("");
    try {
      const { data, error } = await requireSupabase().functions.invoke("send-reminder", { body: { staffNo } });
      if (error) {
        const details = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
        throw new Error(details?.error ?? "Could not send the reminder. Check that the email function is deployed and configured.");
      }
      if (!data?.accepted) throw new Error(data?.error ?? "Email was not accepted for sending.");
      setSent(previous => new Set([...previous, staffNo]));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send reminder.");
    } finally {
      inFlight.current.delete(staffNo);
      setSending(new Set(inFlight.current));
    }
  };
  return { sendReminder, sentReminders, sendingReminders, reminderError };
}
