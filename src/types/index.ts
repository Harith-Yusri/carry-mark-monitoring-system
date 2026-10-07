export type Role = "lecturer" | "admin";

export type LecturerScreen = "dashboard" | "subject-hub";
export type LecturerTab = "assessments" | "marks" | "export";
export type AdminTab = "overview" | "submissions" | "directory" | "compliance" | "settings";
export type ProgrammeCode = string;

export interface ProgrammeOption {
  id: string;
  code: string;
  name: string;
}

export interface ProgrammeTeachingStatus extends ProgrammeOption {
  subjects: string[];
  subjectName: string;
  studentCount: number;
  deadline: string;
  submissionStatus: "Finalised" | "In Progress" | "Overdue";
  lastUpdated: string;
  completionRate: number;
}

export interface ClassTeachingAllocation {
  id: string;
  offeringId: string;
  programmeId: string;
  programmeCode: string;
  programmeName: string;
  subjectCode: string;
  subjectName: string;
  classLabel: string;
  studentCount: number;
  deadline: string;
  submissionStatus: "Finalised" | "In Progress" | "Overdue";
  lastUpdated: string;
  completionRate: number;
}

export interface LecturerInfo {
  id: string;
  name: string;
  department: string;
  programmeCodes: ProgrammeCode[];
  programmeAssignments: ProgrammeTeachingStatus[];
  classAllocations: ClassTeachingAllocation[];
  subjects: string[];
  subjectName: string;
  studentCount: number;
  deadline: string;
  submissionStatus: "Finalised" | "In Progress" | "Overdue";
  lastUpdated: string;
  completionRate: number;
}
