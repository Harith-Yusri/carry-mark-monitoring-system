import { AuditLog, ClassSectionRecord, LecturerInfo, ProgrammeCode, StudentRecord } from "../types";

export const ACADEMIC_SESSION = "Semester 2, 2025/2026";
export const SEMESTER_LABEL = "2 / 2025/2026";
export const CARRY_MAX = 50;
export const ELIGIBLE_THRESHOLD = 40;

export const programmeNames: Record<ProgrammeCode, string> = {
  CS: "Computer Science",
  IT: "Information Technology",
  IS: "Information Systems",
};

export const lecturerAccount = {
  id: "TS003",
  name: "Dr. Siti Rahimah",
  programmeCode: "IT" as ProgrammeCode,
};

export const lecturerSubjectsData = [
  { code: "ITT593", name: "Database Systems", progSem: 5, students: 42, lastSync: "24 Jun 14:30", status: "submitted" },
  { code: "ITT557", name: "Mobile Application Development", progSem: 4, students: 30, lastSync: "23 Jun 10:15", status: "active" },
  { code: "ITT588", name: "Front-End Web Development", progSem: 5, students: 36, lastSync: "22 Jun 16:40", status: "active" },
  { code: "ITT569", name: "Internet of Things", progSem: 6, students: 28, lastSync: null, status: "draft" },
];

export const lecturerClassesData: StudentRecord[] = [
  { id: "S001", matrixNo: "20221123001", name: "Muhammad Haziq Bin Rosli", group: "Class A", quiz1: 8, assign1: 18, test1: 25, quiz2: 7, test2: 23, totalCarry: 40.5, eligible: true, status: "submitted" },
  { id: "S002", matrixNo: "20221123002", name: "Nurul Ain Sofea Bt Ahmad", group: "Class A", quiz1: 9, assign1: 19, test1: 27, quiz2: 8, test2: 25, totalCarry: 44, eligible: true, status: "submitted" },
  { id: "S003", matrixNo: "20221123003", name: "Ahmad Farhan Bin Malik", group: "Class A", quiz1: 7, assign1: 15, test1: 20, quiz2: 6, test2: 18, totalCarry: 33, eligible: false, status: "submitted" },
  { id: "S004", matrixNo: "20221123004", name: "Siti Nabilah Bt Zainudin", group: "Class A", quiz1: 8, assign1: 17, test1: 23, quiz2: 7, test2: 22, totalCarry: 38.5, eligible: false, status: "submitted" },
  { id: "S005", matrixNo: "20221123005", name: "Amirul Hakeem Bin Aziz", group: "Class A", quiz1: 6, assign1: 16, test1: 22, quiz2: 5, test2: 19, totalCarry: 34, eligible: false, status: "submitted" },
  { id: "S006", matrixNo: "20221123006", name: "Farah Liyana Bt Ismail", group: "Class A", quiz1: 9, assign1: 20, test1: 28, quiz2: 9, test2: 27, totalCarry: 46.5, eligible: true, status: "submitted" },
];

const subjectClassCapacities: Record<string, [number, number, number]> = {
  ITT593: [15, 16, 11],
  ITT557: [10, 10, 10],
  ITT588: [12, 12, 12],
  ITT569: [10, 9, 9],
};

export function getLecturerClassSections(subjectCode: string): ClassSectionRecord[] {
  const [classA, classB, classC] = subjectClassCapacities[subjectCode] ?? [15, 16, 11];
  return [
    { id: "SEC-A", label: "Class A", day: "Monday", time: "8:00–10:00", room: "Bilik Kuliah 1", capacity: classA, students: lecturerClassesData.map(student => ({ ...student })), finalised: false },
    { id: "SEC-B", label: "Class B", day: "Tuesday", time: "10:00–12:00", room: "Bilik Kuliah 3", capacity: classB, students: [], finalised: false },
    { id: "SEC-C", label: "Class C", day: "Wednesday", time: "14:00–16:00", room: "Lab Komputer 2", capacity: classC, students: [], finalised: false },
  ];
}

export const facultyLecturersData: LecturerInfo[] = [
  { id: "TS001", name: "Dr. Ahmad Zulkifli", programmeCode: "CS", department: programmeNames.CS, subjects: ["BCS101"], subjectName: "Programming Fundamentals", studentCount: 42, deadline: "20 Jun 2026", submissionStatus: "Finalised", lastUpdated: "20 Jun 2026 14:10", completionRate: 100 },
  { id: "TS002", name: "Prof. Nurul Huda", programmeCode: "CS", department: programmeNames.CS, subjects: ["BCS203"], subjectName: "Data Structures & Algorithms", studentCount: 38, deadline: "20 Jun 2026", submissionStatus: "In Progress", lastUpdated: "18 Jun 2026 09:40", completionRate: 65 },
  { id: "TS004", name: "Mr. Hafizuddin Yusof", programmeCode: "CS", department: programmeNames.CS, subjects: ["BCS420"], subjectName: "Software Engineering", studentCount: 31, deadline: "20 Jun 2026", submissionStatus: "Overdue", lastUpdated: "10 Jun 2026 16:20", completionRate: 20 },
  { id: "TS007", name: "Dr. Razif Bin Othman", programmeCode: "CS", department: programmeNames.CS, subjects: ["BCS505"], subjectName: "Computer Graphics", studentCount: 24, deadline: "20 Jun 2026", submissionStatus: "Finalised", lastUpdated: "19 Jun 2026 15:05", completionRate: 100 },
  { id: "TS003", name: lecturerAccount.name, programmeCode: "IT", department: programmeNames.IT, subjects: lecturerSubjectsData.map(subject => subject.code), subjectName: "Database Systems and 3 additional subjects", studentCount: 42, deadline: "20 Jun 2026", submissionStatus: "Finalised", lastUpdated: "24 Jun 2026 14:30", completionRate: 100 },
  { id: "TS005", name: "Dr. Lim Wei Chen", programmeCode: "IT", department: programmeNames.IT, subjects: ["BIT450"], subjectName: "Network Security", studentCount: 28, deadline: "20 Jun 2026", submissionStatus: "In Progress", lastUpdated: "17 Jun 2026 12:10", completionRate: 70 },
  { id: "TS008", name: "Madam Fauziah Bt Ismail", programmeCode: "IT", department: programmeNames.IT, subjects: ["BIT201"], subjectName: "Web Technologies", studentCount: 36, deadline: "20 Jun 2026", submissionStatus: "Overdue", lastUpdated: "12 Jun 2026 10:45", completionRate: 35 },
  { id: "TS009", name: "Dr. Kamarul Ariffin", programmeCode: "IT", department: programmeNames.IT, subjects: ["BIT305"], subjectName: "Mobile Applications", studentCount: 30, deadline: "20 Jun 2026", submissionStatus: "Finalised", lastUpdated: "20 Jun 2026 11:50", completionRate: 100 },
  { id: "TS006", name: "Dr. Aina Farhana", programmeCode: "IS", department: programmeNames.IS, subjects: ["BIS305"], subjectName: "Enterprise Systems", studentCount: 39, deadline: "20 Jun 2026", submissionStatus: "Finalised", lastUpdated: "19 Jun 2026 13:25", completionRate: 100 },
  { id: "TS010", name: "Mr. Syafiq Bin Hassan", programmeCode: "IS", department: programmeNames.IS, subjects: ["BIS101"], subjectName: "Systems Analysis & Design", studentCount: 35, deadline: "20 Jun 2026", submissionStatus: "In Progress", lastUpdated: "16 Jun 2026 08:55", completionRate: 55 },
  { id: "TS011", name: "Dr. Nadia Binti Omar", programmeCode: "IS", department: programmeNames.IS, subjects: ["BIS410"], subjectName: "Information Systems Audit", studentCount: 37, deadline: "20 Jun 2026", submissionStatus: "Finalised", lastUpdated: "20 Jun 2026 09:15", completionRate: 100 },
];

export const auditLogsData: AuditLog[] = [
  { id: "LOG-901", timestamp: "2026-06-24 14:30:12", actor: lecturerAccount.name, role: "Lecturer", action: "Finalised Carry Marks", subjectCode: "ITT593" },
  { id: "LOG-902", timestamp: "2026-06-20 14:10:00", actor: "Dr. Ahmad Zulkifli", role: "Lecturer", action: "Finalised Carry Marks", subjectCode: "BCS101" },
  { id: "LOG-903", timestamp: "2026-06-19 09:00:00", actor: "Faculty Administrator", role: "Administrator", action: "Submission Reminder Sent", subjectCode: "BCS420" },
];
