import { useCallback, useEffect, useState } from "react";
import { requireSupabase } from "../lib/supabase";
import { userError } from "../utils/errors";
import { ClassTeachingAllocation, LecturerInfo, ProgrammeOption } from "../types";

function relationRows<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

export interface AdminAcademicContext {
  termId: string;
  termLabel: string;
  semesterCode: string;
  semesterNo: number;
  academicYear: string;
  defaultDeadline: string;
  programmes: ProgrammeOption[];
}

export interface AdminRecordsViewProps {
  records: LecturerInfo[];
  context: AdminAcademicContext | null;
  loading: boolean;
  error: string;
}

export type SubmissionAllocation = ClassTeachingAllocation & { staffId: string; lecturerName: string };

export function submissionAllocations(records: LecturerInfo[]): SubmissionAllocation[] {
  return records.flatMap(lecturer => lecturer.classAllocations.map(allocation => ({
    staffId: lecturer.id,
    lecturerName: lecturer.name,
    ...allocation,
  })));
}

export function requiresSubmissionAction(allocation: ClassTeachingAllocation): boolean {
  return allocation.submissionStatus !== "Finalised";
}

export function useAdminRecords() {
  const [records, setRecords] = useState<LecturerInfo[]>([]);
  const [context, setContext] = useState<AdminAcademicContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const db = requireSupabase();
    const { data, error: overviewError } = await db.rpc("get_admin_current_overview");
    if (overviewError) throw overviewError;
    const overview = data as any;
    const term = overview?.term;
    const programmes = overview?.programmes ?? [];
    if (!term) throw new Error("No active academic semester is configured.");
    const profiles = (overview?.lecturers ?? []).map((lecturer: any) => ({
      id: lecturer.auth_id,
      staff_no: lecturer.staff_no,
      full_name: lecturer.full_name,
      offerings: [...new Map((lecturer.allocations ?? []).map((allocation: any) => [allocation.offering_id, allocation.offering_id])).keys()].map(offeringId => {
        const rows = (lecturer.allocations ?? []).filter((allocation: any) => allocation.offering_id === offeringId);
        const first = rows[0];
        return {
          id: first.offering_id,
          status: first.offering_status,
          deadline_at: first.deadline_at,
          updated_at: first.offering_updated_at,
          subject_name_override: null,
          subjects: { code: first.subject_code, name: first.subject_name },
          class_sections: rows.filter((row: any) => row.section_id).map((row: any) => ({
            id: row.section_id,
            label: row.class_label,
            programme_id: row.programme_id,
            updated_at: row.section_updated_at,
            deadline_at: row.deadline_at,
            programmes: { id: row.programme_id, code: row.programme_code, name: row.programme_name },
            enrolments: [{ count: row.student_count }],
            submissions: row.submission_status ? [{ status: row.submission_status, updated_at: row.submission_updated_at }] : [],
          })),
        };
      }),
    }));
    const programmeDeadlines = new Map<string, string>();
    const result = (profiles as any[]).map(profile => {
      const offerings = profile.offerings;
      const sections = offerings.flatMap(offering => relationRows<any>(offering.class_sections));
      const finalised = sections.filter(section => relationRows<any>(section.submissions).some((submission: any) => submission.status === "finalised")).length;
      const deadline = offerings.flatMap(offering => {
        const offeringSections = relationRows<any>(offering.class_sections);
        return offeringSections.length
          ? offeringSections.map(section => section.deadline_at ?? offering.deadline_at ?? programmeDeadlines.get(section.programme_id) ?? term.default_deadline)
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
      const classAllocations = offerings.flatMap(offering => relationRows<any>(offering.class_sections).map(section => {
        const sectionSubmissions = relationRows<any>(section.submissions);
        const isFinalised = sectionSubmissions.some((submission: any) => submission.status === "finalised");
        const sectionDeadline = section.deadline_at ?? offering.deadline_at ?? programmeDeadlines.get(section.programme_id) ?? term.default_deadline;
        const isOverdue = !isFinalised && new Date(sectionDeadline) < new Date();
        const activityDates = [offering.updated_at, section.updated_at, ...sectionSubmissions.map((submission: any) => submission.updated_at)].filter(Boolean).sort();
        return {
          id: section.id,
          offeringId: offering.id,
          programmeId: section.programme_id,
          programmeCode: section.programmes.code,
          programmeName: section.programmes.name,
          subjectCode: offering.subjects.code,
          subjectName: offering.subject_name_override ?? offering.subjects.name,
          classLabel: section.label,
          studentCount: Number(relationRows<any>(section.enrolments)[0]?.count ?? 0),
          deadline: new Date(sectionDeadline).toLocaleDateString(),
          submissionStatus: (isFinalised ? "Finalised" : isOverdue ? "Overdue" : "In Progress") as LecturerInfo["submissionStatus"],
          lastUpdated: activityDates.length ? new Date(activityDates.at(-1)).toLocaleString() : "No activity",
          completionRate: isFinalised ? 100 : 0,
        };
      }));
      const programmeAssignments = assignedProgrammes.map(programme => {
        const programmeOfferings = offerings.filter(offering => {
          const offeringSections = relationRows<any>(offering.class_sections);
          return offeringSections.some(section => section.programme_id === programme.id);
        });
        const programmeSections = programmeOfferings.flatMap(offering => relationRows<any>(offering.class_sections).filter(section => section.programme_id === programme.id));
        const programmeFinalised = programmeSections.filter(section => relationRows<any>(section.submissions).some((submission: any) => submission.status === "finalised")).length;
        const programmeDeadline = programmeSections.map(section => section.deadline_at ?? programmeDeadlines.get(programme.id) ?? term.default_deadline).sort()[0] ?? term.default_deadline;
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
        classAllocations,
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
      semesterCode: term.semester_code,
      semesterNo: term.semester_no,
      academicYear: term.academic_year,
      defaultDeadline: term.default_deadline,
      programmes: programmes.map(({ id, code, name }) => ({ id, code, name })),
    });
  }, []);

  const reload = useCallback(() => load()
    .catch(reason => setError(userError(reason, "Unable to refresh administrative records.")))
    .finally(() => setLoading(false)), [load]);

  useEffect(() => {
    load().catch(reason => setError(userError(reason, "Unable to load administrative records."))).finally(() => setLoading(false));
  }, [load]);
  return { records, context, loading, error, reload };
}
