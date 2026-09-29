import { useEffect, useState } from "react";
import { requireSupabase } from "../lib/supabase";
import { LecturerInfo, ProgrammeCode } from "../types";

function relationRows<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

export function useAdminRecords() {
  const [records, setRecords] = useState<LecturerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    const { data, error } = await requireSupabase().from("profiles").select(`
      id, staff_no, full_name, programmes(code,name),
      subject_offerings(id,status,deadline_at,updated_at,subjects(code,name),class_sections(id,enrolments(count),submissions(status,updated_at)))
    `).eq("role", "lecturer").eq("is_active", true);
    if (error) throw error;
    const result = (data as any[]).map(profile => {
      const offerings = relationRows<any>(profile.subject_offerings);
      const sections = offerings.flatMap((offering: any) => relationRows<any>(offering.class_sections));
      const finalised = sections.filter((section: any) => relationRows<any>(section.submissions).some((submission: any) => submission.status === "finalised")).length;
      const deadline = offerings.map((offering: any) => offering.deadline_at).filter(Boolean).sort()[0] ?? null;
      const overdue = deadline && new Date(deadline) < new Date();
      const dates = offerings.flatMap((offering: any) => [offering.updated_at, ...relationRows<any>(offering.class_sections).flatMap((section: any) => relationRows<any>(section.submissions).map((submission: any) => submission.updated_at))]).filter(Boolean).sort();
      return {
        id: profile.staff_no,
        name: profile.full_name,
        programmeCode: (profile.programmes?.code ?? "IT") as ProgrammeCode,
        department: profile.programmes?.name ?? "Unassigned",
        subjects: offerings.map((offering: any) => offering.subjects.code),
        subjectName: offerings.map((offering: any) => offering.subjects.name).join(", ") || "No assigned subjects",
        studentCount: sections.reduce((sum: number, section: any) => sum + Number(relationRows<any>(section.enrolments)[0]?.count ?? 0), 0),
        deadline: deadline ? new Date(deadline).toLocaleDateString() : "Default term deadline",
        submissionStatus: (sections.length && finalised === sections.length ? "Finalised" : overdue ? "Overdue" : "In Progress") as LecturerInfo["submissionStatus"],
        lastUpdated: dates.length ? new Date(dates.at(-1)).toLocaleString() : "No activity",
        completionRate: sections.length ? Math.round(finalised / sections.length * 100) : 0,
      };
    });
    setRecords(result);
  };
  useEffect(() => { load().catch(reason => setError(reason.message)).finally(() => setLoading(false)); }, []);
  return { records, loading, error, reload: () => load().catch(reason => setError(reason.message)).finally(() => setLoading(false)) };
}
