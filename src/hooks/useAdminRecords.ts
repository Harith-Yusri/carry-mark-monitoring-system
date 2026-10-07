import { useEffect, useState } from "react";
import { requireSupabase } from "../lib/supabase";
import { LecturerInfo, ProgrammeOption } from "../types";

function relationRows<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

export interface AdminAcademicContext {
  termId: string;
  termLabel: string;
  semesterNo: number;
  academicYear: string;
  defaultDeadline: string;
  programmes: ProgrammeOption[];
}

export function useAdminRecords() {
  const [records, setRecords] = useState<LecturerInfo[]>([]);
  const [context, setContext] = useState<AdminAcademicContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    const db = requireSupabase();
    const [{ data: term, error: termError }, { data: programmes, error: programmeError }] = await Promise.all([
      db.from("academic_terms").select("id,academic_year,semester_no,default_deadline").eq("is_current", true).maybeSingle(),
      db.from("programmes").select("id,code,name").eq("is_active", true).order("code"),
    ]);
    if (termError) throw termError;
    if (programmeError) throw programmeError;
    if (!term) throw new Error("No current academic term is configured.");

    const [
      { data: deadlines, error: deadlineError },
      { data: profiles, error: profileError },
      { data: currentOfferings, error: offeringError },
    ] = await Promise.all([
      db.from("programme_deadlines").select("programme_id,deadline_at").eq("term_id", term.id),
      db.from("profiles").select("id,staff_no,full_name").eq("role", "lecturer").eq("is_active", true),
      db.from("subject_offerings").select(`
        id, lecturer_id, status, term_id, deadline_at, updated_at, subject_name_override,
        subjects!subject_offerings_subject_id_fkey(code,name),
        academic_terms!inner(is_current),
        class_sections(id,programme_id,programmes!class_sections_programme_id_fkey(id,code,name),enrolments(count),submissions(status,updated_at))
      `).eq("academic_terms.is_current", true),
    ]);
    if (deadlineError) throw deadlineError;
    if (profileError) throw profileError;
    if (offeringError) throw offeringError;

    const programmeDeadlines = new Map(deadlines.map(row => [row.programme_id, row.deadline_at]));
    const offeringsByLecturer = new Map<string, any[]>();
    for (const offering of currentOfferings as any[]) {
      const lecturerOfferings = offeringsByLecturer.get(offering.lecturer_id) ?? [];
      lecturerOfferings.push(offering);
      offeringsByLecturer.set(offering.lecturer_id, lecturerOfferings);
    }
    const result = (profiles as any[]).map(profile => {
      const offerings = offeringsByLecturer.get(profile.id) ?? [];
      const sections = offerings.flatMap(offering => relationRows<any>(offering.class_sections));
      const finalised = sections.filter(section => relationRows<any>(section.submissions).some((submission: any) => submission.status === "finalised")).length;
      const deadline = offerings.flatMap(offering => {
        const offeringSections = relationRows<any>(offering.class_sections);
        return offeringSections.length
          ? offeringSections.map(section => offering.deadline_at ?? programmeDeadlines.get(section.programme_id) ?? term.default_deadline)
          : [offering.deadline_at ?? term.default_deadline];
      }).sort()[0] ?? term.default_deadline;
      const overdue = sections.length > finalised && new Date(deadline) < new Date();
      const dates = offerings.flatMap(offering => [offering.updated_at, ...relationRows<any>(offering.class_sections).flatMap((section: any) => relationRows<any>(section.submissions).map((submission: any) => submission.updated_at))]).filter(Boolean).sort();
      const programmePairs = offerings.flatMap(offering => {
        const offeringSections = relationRows<any>(offering.class_sections);
        return offeringSections
          .filter(section => section.programmes)
          .map(section => [section.programme_id, section.programmes] as const);
      });
      const assignedProgrammes = [...new Map(programmePairs).values()] as any[];
      const programmeAssignments = assignedProgrammes.map(programme => {
        const programmeOfferings = offerings.filter(offering => {
          const offeringSections = relationRows<any>(offering.class_sections);
          return offeringSections.some(section => section.programme_id === programme.id);
        });
        const programmeSections = programmeOfferings.flatMap(offering => relationRows<any>(offering.class_sections).filter(section => section.programme_id === programme.id));
        const programmeFinalised = programmeSections.filter(section => relationRows<any>(section.submissions).some((submission: any) => submission.status === "finalised")).length;
        const programmeDeadline = programmeOfferings.map(offering => offering.deadline_at ?? programmeDeadlines.get(programme.id) ?? term.default_deadline).sort()[0] ?? term.default_deadline;
        const programmeOverdue = programmeSections.length > programmeFinalised && new Date(programmeDeadline) < new Date();
        const programmeDates = programmeOfferings.flatMap(offering => [
          offering.updated_at,
          ...relationRows<any>(offering.class_sections)
            .filter((section: any) => section.programme_id === programme.id)
            .flatMap((section: any) => relationRows<any>(section.submissions).map((submission: any) => submission.updated_at)),
        ]).filter(Boolean).sort();
        return {
          id: programme.id,
          code: programme.code,
          name: programme.name,
          subjects: programmeOfferings.map(offering => offering.subjects.code),
          subjectName: programmeOfferings.map(offering => offering.subject_name_override ?? offering.subjects.name).join(", ") || "No assigned subjects",
          studentCount: programmeSections.reduce((sum: number, section: any) => sum + Number(relationRows<any>(section.enrolments)[0]?.count ?? 0), 0),
          deadline: new Date(programmeDeadline).toLocaleDateString(),
          submissionStatus: (programmeSections.length && programmeFinalised === programmeSections.length ? "Finalised" : programmeOverdue ? "Overdue" : "In Progress") as LecturerInfo["submissionStatus"],
          lastUpdated: programmeDates.length ? new Date(programmeDates.at(-1)).toLocaleString() : "No activity",
          completionRate: programmeSections.length ? Math.round(programmeFinalised / programmeSections.length * 100) : 0,
        };
      });
      return {
        id: profile.staff_no,
        name: profile.full_name,
        programmeCodes: assignedProgrammes.map(programme => programme.code),
        programmeAssignments,
        department: assignedProgrammes.map(programme => programme.name).join(", ") || "No current teaching assignment",
        subjects: offerings.map(offering => offering.subjects.code),
        subjectName: offerings.map(offering => offering.subject_name_override ?? offering.subjects.name).join(", ") || "No assigned subjects",
        studentCount: sections.reduce((sum: number, section: any) => sum + Number(relationRows<any>(section.enrolments)[0]?.count ?? 0), 0),
        deadline: new Date(deadline).toLocaleDateString(),
        submissionStatus: (sections.length && finalised === sections.length ? "Finalised" : overdue ? "Overdue" : "In Progress") as LecturerInfo["submissionStatus"],
        lastUpdated: dates.length ? new Date(dates.at(-1)).toLocaleString() : "No activity",
        completionRate: sections.length ? Math.round(finalised / sections.length * 100) : 0,
      };
    });
    setRecords(result);
    setContext({
      termId: term.id,
      termLabel: `Semester ${term.semester_no} · ${term.academic_year}`,
      semesterNo: term.semester_no,
      academicYear: term.academic_year,
      defaultDeadline: term.default_deadline,
      programmes: programmes.map(({ id, code, name }) => ({ id, code, name })),
    });
  };

  useEffect(() => { load().catch(reason => setError(reason.message)).finally(() => setLoading(false)); }, []);
  return { records, context, loading, error, reload: () => load().catch(reason => setError(reason.message)).finally(() => setLoading(false)) };
}
