export type Role = "lecturer" | "admin";

export type LecturerScreen = "dashboard" | "subject-hub";
export type LecturerTab = "assessments" | "marks" | "export";
export type AdminTab = "overview" | "submissions" | "directory" | "compliance" | "settings";
export type ProgrammeCode = "CS" | "IT" | "IS";

export interface StudentRecord {
  id: string;
  matrixNo: string;
  name: string;
  group: string;
  quiz1: number | null;
  assign1: number | null;
  test1: number | null;
  quiz2: number | null;
  test2: number | null;
  totalCarry: number | null;
  eligible: boolean | null;
  status: "submitted" | "pending" | "disputed";
}

export interface LecturerInfo {
  id: string;
  name: string;
  department: string;
  programmeCode: ProgrammeCode;
  subjects: string[];
  subjectName: string;
  studentCount: number;
  deadline: string;
  submissionStatus: "Finalised" | "In Progress" | "Overdue";
  lastUpdated: string;
  completionRate: number;
}

export interface ClassSectionRecord {
  id: string;
  label: string;
  day: string;
  time: string;
  room: string;
  capacity: number;
  students: StudentRecord[];
  finalised: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  subjectCode: string;
}
