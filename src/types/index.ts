export type Role = "lecturer" | "admin";

export type LecturerScreen = "dashboard" | "subject-hub";
export type LecturerTab = "assessments" | "marks" | "export";
export type AdminTab = "overview" | "submissions" | "directory" | "compliance" | "settings";
export type ProgrammeCode = "CS" | "IT" | "IS";

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
