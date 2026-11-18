import { requireSupabase } from "../lib/supabase";
import { mapSubjectSummary, type SubjectSummary } from "./carryMarkApi";
import { groupLecturerSubjects } from "./lecturerSubjectGroups";

export type LecturerNotification = {
  id: string; title: string; body: string; created_at: string; read_at: string | null;
  data: { studentName: string; subjectCode: string; classLabel: string; assessmentName: string; submittedAt: string };
};
export type NotificationPage = { items: LecturerNotification[]; has_more: boolean; unread_count: number };
export type MarkIssueNotificationTarget = { notificationId: string; readAt: string; unreadCount: number; issueId: string; subject: SubjectSummary };
export async function loadLecturerNotifications(cursor?: LecturerNotification): Promise<NotificationPage> {
  const { data, error } = await requireSupabase().rpc("get_my_lecturer_notifications", cursor ? { before_created_at: cursor.created_at, before_id: cursor.id } : {});
  if (error) throw error;
  return data as unknown as NotificationPage;
}
export async function openLecturerNotification(id: string): Promise<MarkIssueNotificationTarget> {
  const { data, error } = await requireSupabase().rpc("open_my_mark_issue_notification", { target_notification: id });
  if (error) throw error;
  const result = data as any;
  const subject = groupLecturerSubjects(result.subject_rows.map(mapSubjectSummary))[0];
  if (!subject) throw new Error("Notification subject is unavailable.");
  return { notificationId: result.notification_id, readAt: result.read_at, unreadCount: Number(result.unread_count), issueId: result.issue_id, subject };
}
export function subscribeLecturerNotifications(authId: string, onInsert: () => void, onStatus: (ready: boolean) => void, onRead: (id: string, readAt: string) => void) {
  const db = requireSupabase();
  const channel = db.channel(`lecturer-issues:${authId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${authId}` }, payload => {
      if (payload.new.type === "mark_issue_submitted") onInsert();
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `recipient_id=eq.${authId}` }, payload => {
      if (payload.new.type === "mark_issue_submitted" && payload.new.read_at) onRead(payload.new.id, payload.new.read_at);
    })
    .subscribe(status => onStatus(status === "SUBSCRIBED"));
  return () => { void db.removeChannel(channel); };
}
