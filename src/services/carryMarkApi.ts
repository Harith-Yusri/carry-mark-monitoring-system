import { requireSupabase } from "../lib/supabase";
import { ProgrammeOption } from "../types";

export interface SubjectSummary {
  offeringId: string;
  programmeId: string;
  programmeIds: string[];
  programmeCodes: string[];
  programmeNames: string[];
  programmeCode: string;
  programmeName: string;
  code: string;
  name: string;
  progSem: number;
  students: number;
  lastSync: string | null;
  status: string;
  termLabel: string;
  academicYear: string;
  semesterNo: number;
}

export interface AssessmentRecord {
  id: string;
  name: string;
  type: string;
  maxMarks: number;
  weightage: number;
  position: number;
}

export interface MarkStudent {
  enrolmentId: string;
  studentId: string;
  matrixNo: string;
  name: string;
  scores: Record<string, number | null>;
  totalCarry: number;
  eligible: boolean;
}

export interface SectionRecord {
  id: string;
  programmeId: string;
  programmeCode: string;
  programmeName: string;
  label: string;
  dayOfWeek: number | null;
  startsAt: string | null;
  endsAt: string | null;
  room: string | null;
  capacity: number;
  joinCode: string | null;
  finalised: boolean;
  students: MarkStudent[];
}

export async function listLecturerSubjects(): Promise<SubjectSummary[]> {
  const { data, error } = await requireSupabase().rpc("get_my_lecturer_subjects");
  if (error) throw error;
  return data.map(row => ({
    offeringId: row.offering_id,
    programmeId: row.programme_ids[0] ?? "",
    programmeIds: row.programme_ids,
    programmeCodes: row.programme_codes,
    programmeNames: row.programme_names,
    programmeCode: row.programme_codes.join(", "),
    programmeName: row.programme_names.join(", "),
    code: row.subject_code,
    name: row.subject_name,
    progSem: row.programme_semester ?? 0,
    students: Number(row.student_count),
    lastSync: row.updated_at,
    status: row.offering_status === "completed" ? "submitted" : row.offering_status,
    termLabel: `Session ${row.semester_no}, ${row.academic_year}`,
    academicYear: row.academic_year,
    semesterNo: row.semester_no,
  }));
}

export async function listAssessments(offeringId: string): Promise<AssessmentRecord[]> {
  const { data, error } = await requireSupabase().from("assessments")
    .select("id,name,assessment_type,max_score,carry_weight,position")
    .eq("offering_id", offeringId).order("position");
  if (error) throw error;
  return data.map(row => ({ id: row.id, name: row.name, type: row.assessment_type, maxMarks: Number(row.max_score), weightage: Number(row.carry_weight), position: row.position }));
}

export async function saveAssessment(offeringId: string, item: Omit<AssessmentRecord, "id" | "position">, id?: string) {
  const db = requireSupabase();
  if (id) {
    const { error } = await db.from("assessments").update({ name: item.name, assessment_type: item.type, max_score: item.maxMarks, carry_weight: item.weightage }).eq("id", id);
    if (error) throw error;
  } else {
    const existing = await listAssessments(offeringId);
    const { error } = await db.from("assessments").insert({ offering_id: offeringId, name: item.name, assessment_type: item.type, max_score: item.maxMarks, carry_weight: item.weightage, position: existing.length + 1 });
    if (error) throw error;
  }
}

export async function deleteAssessment(id: string) {
  const { error } = await requireSupabase().from("assessments").delete().eq("id", id);
  if (error) throw error;
}

export async function loadOfferingData(offeringId: string): Promise<{ assessments: AssessmentRecord[]; sections: SectionRecord[] }> {
  const db = requireSupabase();
  const assessments = await listAssessments(offeringId);
  const { data: sectionRows, error: sectionError } = await db.from("class_sections").select("*,programmes!inner(code,name)").eq("offering_id", offeringId).order("label");
  if (sectionError) throw sectionError;
  const sectionIds = sectionRows.map(row => row.id);
  if (!sectionIds.length) return { assessments, sections: [] };
  const [{ data: enrolments, error: enrolError }, { data: submissions, error: submissionError }] = await Promise.all([
    db.from("enrolments").select("id,section_id,student_id,students!inner(matrix_no,full_name)").in("section_id", sectionIds).eq("status", "enrolled"),
    db.from("submissions").select("section_id,status").in("section_id", sectionIds),
  ]);
  if (enrolError) throw enrolError;
  if (submissionError) throw submissionError;
  const enrolmentIds = enrolments.map(row => row.id);
  const [{ data: marks, error: marksError }, { data: totals, error: totalsError }] = enrolmentIds.length ? await Promise.all([
    db.from("marks").select("enrolment_id,assessment_id,score").in("enrolment_id", enrolmentIds),
    db.from("student_carry_totals").select("enrolment_id,total_carry,eligible").in("enrolment_id", enrolmentIds),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (marksError) throw marksError;
  if (totalsError) throw totalsError;
  const marksByEnrolment = new Map<string, Record<string, number | null>>();
  marks.forEach(row => { const values = marksByEnrolment.get(row.enrolment_id) ?? {}; values[row.assessment_id] = row.score == null ? null : Number(row.score); marksByEnrolment.set(row.enrolment_id, values); });
  const totalsByEnrolment = new Map(totals.map(row => [row.enrolment_id, row]));
  return { assessments, sections: sectionRows.map(row => ({
    id: row.id, programmeId: row.programme_id, programmeCode: (row.programmes as any).code, programmeName: (row.programmes as any).name,
    label: row.label, dayOfWeek: row.day_of_week, startsAt: row.starts_at, endsAt: row.ends_at,
    room: row.room, capacity: row.capacity, joinCode: row.join_code,
    finalised: submissions.some(value => value.section_id === row.id && value.status === "finalised"),
    students: (enrolments as any[]).filter(value => value.section_id === row.id).map(value => ({
      enrolmentId: value.id, studentId: value.student_id, matrixNo: value.students.matrix_no, name: value.students.full_name,
      scores: marksByEnrolment.get(value.id) ?? {}, totalCarry: Number(totalsByEnrolment.get(value.id)?.total_carry ?? 0),
      eligible: Boolean(totalsByEnrolment.get(value.id)?.eligible),
    })),
  })) };
}

export async function upsertMark(enrolmentId: string, assessmentId: string, score: number, enteredBy: string) {
  const { error } = await requireSupabase().from("marks").upsert({ enrolment_id: enrolmentId, assessment_id: assessmentId, score, entered_by: enteredBy }, { onConflict: "enrolment_id,assessment_id" });
  if (error) throw error;
}

export async function finaliseSection(sectionId: string) {
  const { error } = await requireSupabase().rpc("finalise_section", { target_section: sectionId });
  if (error) throw error;
}

export async function listProgrammes(): Promise<ProgrammeOption[]> {
  const { data, error } = await requireSupabase().from("programmes")
    .select("id,code,name").eq("is_active", true).order("code");
  if (error) throw error;
  return data;
}

export async function createSection(offeringId: string, values: { label: string; capacity: number; programmeId: string }) {
  const code = `JOIN-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  const { error } = await requireSupabase().from("class_sections").insert({ offering_id: offeringId, programme_id: values.programmeId, label: values.label, capacity: values.capacity, join_code: code });
  if (error) throw error;
}

export async function updateSection(id: string, values: { label: string; capacity: number; programmeId: string }) {
  const { error } = await requireSupabase().from("class_sections").update({ programme_id: values.programmeId, label: values.label, capacity: values.capacity }).eq("id", id);
  if (error) throw error;
}

export async function rotateJoinCode(sectionId: string) {
  const { data, error } = await requireSupabase().rpc("rotate_class_join_code", { target_section: sectionId });
  if (error) throw error;
  return data;
}

export async function deleteSection(id: string) {
  const { error } = await requireSupabase().from("class_sections").delete().eq("id", id);
  if (error) throw error;
}

export interface SystemSettingsRecord {
  termId: string; currentSemester: string; semesterStart: string; semesterEnd: string; globalDeadline: string;
  programmes: { id: string; code: string; name: string }[];
  programmeDeadlines: Record<string, string>; autoRemind: boolean; reminderDays: number | null;
  notificationConfigured: boolean;
}

export async function loadSystemSettings(): Promise<SystemSettingsRecord> {
  const db = requireSupabase();
  const { data: term, error } = await db.from("academic_terms").select("*").eq("is_current", true).single();
  if (error) throw error;
  const [{ data: programmes, error: programmeError }, { data: deadlines, error: deadlineError }, { data: notification, error: notificationError }] = await Promise.all([
    db.from("programmes").select("id,code,name").eq("is_active", true).order("code"),
    db.from("programme_deadlines").select("deadline_at,programmes!inner(code)").eq("term_id", term.id),
    db.from("notification_settings").select("*").eq("term_id", term.id).maybeSingle(),
  ]);
  if (programmeError) throw programmeError;
  if (deadlineError) throw deadlineError;
  if (notificationError) throw notificationError;
  const values: Record<string, string> = Object.fromEntries(programmes.map(programme => [programme.code, term.default_deadline.slice(0, 10)]));
  (deadlines as any[]).forEach(row => { if (row.programmes?.code) values[row.programmes.code] = row.deadline_at.slice(0, 10); });
  return {
    termId: term.id,
    currentSemester: `${term.semester_no} / ${term.academic_year}`,
    semesterStart: term.starts_on,
    semesterEnd: term.ends_on,
    globalDeadline: term.default_deadline.slice(0, 10),
    programmes,
    programmeDeadlines: values,
    autoRemind: notification?.auto_remind ?? false,
    reminderDays: notification?.reminder_days ?? null,
    notificationConfigured: Boolean(notification),
  };
}

export async function saveSystemSettings(settings: SystemSettingsRecord, updatedBy?: string) {
  const db = requireSupabase();
  const termMatch = settings.currentSemester.match(/^\s*(\d+)\s*\/\s*(.+?)\s*$/);
  if (!termMatch) throw new Error("Use the session format ‘2 / 2025/2026’. ");
  const [, semesterText, yearText] = termMatch;
  const { error: termError } = await db.from("academic_terms").update({ semester_no: Number(semesterText), academic_year: yearText, starts_on: settings.semesterStart, ends_on: settings.semesterEnd, default_deadline: new Date(`${settings.globalDeadline}T23:59:59+08:00`).toISOString() }).eq("id", settings.termId);
  if (termError) throw termError;
  const deadlineRows = settings.programmes
    .filter(programme => settings.programmeDeadlines[programme.code])
    .map(programme => ({ term_id: settings.termId, programme_id: programme.id, deadline_at: new Date(`${settings.programmeDeadlines[programme.code]}T23:59:59+08:00`).toISOString() }));
  const { error: deadlineError } = deadlineRows.length
    ? await db.from("programme_deadlines").upsert(deadlineRows)
    : { error: null };
  if (deadlineError) throw deadlineError;
  const notificationValues = {
    term_id: settings.termId,
    auto_remind: settings.autoRemind,
    updated_by: updatedBy,
    ...(settings.reminderDays === null ? {} : { reminder_days: settings.reminderDays }),
  };
  const { error: notificationError } = await db.from("notification_settings").upsert(notificationValues);
  if (notificationError) throw notificationError;
}


export interface SubjectCatalogueEntry {
  code: string;
  name: string;
  programme_semester: number | null;
  is_active: boolean;
}

export async function loadSubjectCreationData() {
  const db = requireSupabase();
  const [catalogue, term] = await Promise.all([
    db.from("subjects").select("code,name,programme_semester,is_active").order("code"),
    db.from("academic_terms").select("academic_year,semester_no").eq("is_current", true).eq("status", "active").maybeSingle(),
  ]);
  if (catalogue.error) throw catalogue.error;
  if (term.error) throw term.error;
  if (!term.data) throw new Error("There is no active current academic term.");
  return { catalogue: catalogue.data, termLabel: `Session ${term.data.semester_no}, ${term.data.academic_year}` };
}

export async function loadCurrentTermLabel() {
  const { data, error } = await requireSupabase().from("academic_terms")
    .select("academic_year,semester_no").eq("is_current", true).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("There is no current academic term.");
  return `Session ${data.semester_no}, ${data.academic_year}`;
}

export async function createLecturerSubject(code: string, name: string, semester: number) {
  const { data, error } = await requireSupabase().rpc("create_lecturer_subject", {
    subject_code: code.trim().toUpperCase(), subject_name: name.trim(), programme_semester: semester,
  });
  if (error) throw error;
  return data;
}

export async function updateLecturerSubject(offeringId: string, name: string, semester: number) {
  const { error } = await requireSupabase().rpc("update_lecturer_subject", {
    target_offering: offeringId,
    subject_name: name.trim(),
    programme_semester: semester,
  });
  if (error) throw error;
}


export async function loadOfferingWeightage(offeringId: string) {
  const { data, error } = await requireSupabase().from("subject_offerings")
    .select("carry_max,academic_terms!inner(eligible_threshold)").eq("id", offeringId).single();
  if (error) throw error;
  return { carryMax: data.carry_max === null ? null : Number(data.carry_max), eligibleThreshold: Number((data.academic_terms as any).eligible_threshold) };
}

export async function saveOfferingWeightage(offeringId: string, total: number) {
  const { error } = await requireSupabase().rpc("set_offering_carry_max", { target_offering: offeringId, total_weight: total });
  if (error) throw error;
}
