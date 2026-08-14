import { StudentRecord, LecturerInfo, AuditLog } from "../types";

export const CARRY_MAX = 50;
export const ELIGIBLE_THRESHOLD = 40;

export const lecturerClassesData: StudentRecord[] = [
  { id: "S101", matrixNo: "2024102938", name: "Ahmad Farhan Bin Zulkifli",  group: "CS240 4A", quiz1: 9, assign1: 18, test1: 27, quiz2: 8, test2: 26, totalCarry: 44, eligible: true,  status: "submitted" },
  { id: "S102", matrixNo: "2024102939", name: "Siti Sarah Binti Amir",      group: "CS240 4A", quiz1: 8, assign1: 17, test1: 25, quiz2: 7, test2: 24, totalCarry: 40.5, eligible: true, status: "submitted" },
  { id: "S103", matrixNo: "2024102940", name: "Muhammad Daniel Bin Rosli",  group: "CS240 4A", quiz1: 5, assign1: 12, test1: 18, quiz2: 6, test2: 19, totalCarry: 30, eligible: false, status: "submitted" },
  { id: "S104", matrixNo: "2024102941", name: "Nur Aisyah Binti Hassan",    group: "CS240 4B", quiz1: 9, assign1: 19, test1: 28, quiz2: 9, test2: 28, totalCarry: 46.5, eligible: true, status: "submitted" },
  { id: "S105", matrixNo: "2024102942", name: "Khairul Anuar Bin Ridzuan",  group: "CS240 4B", quiz1: 6, assign1: 14, test1: 20, quiz2: 7, test2: 21, totalCarry: 34, eligible: false, status: "disputed" },
  { id: "S106", matrixNo: "2024102943", name: "Farah Nadia Binti Osman",    group: "CS240 4B", quiz1: 7, assign1: 16, test1: 24, quiz2: 8, test2: 23, totalCarry: 39, eligible: false, status: "submitted" },
];

export const facultyLecturersData: LecturerInfo[] = [
  { id: "L01", name: "Dr. Siti Rahimah",     department: "Computer Science", subjects: ["BCS315"], submissionStatus: "Finalised",   lastUpdated: "24 Jun 2026 14:30", completionRate: 100 },
  { id: "L02", name: "Dr. Ahmad Zulkifli",   department: "Computer Science", subjects: ["BCS101"], submissionStatus: "In Progress", lastUpdated: "24 Jun 2026 11:15", completionRate: 85 },
  { id: "L03", name: "Prof. Nurul Huda",     department: "Computer Science", subjects: ["BCS203"], submissionStatus: "In Progress", lastUpdated: "18 Jun 2026 09:40", completionRate: 60 },
  { id: "L04", name: "Mr. Hafizuddin Yusof", department: "Software Eng.",   subjects: ["BCS420"], submissionStatus: "Overdue",     lastUpdated: "10 Jun 2026 16:20", completionRate: 20 },
];

export const auditLogsData: AuditLog[] = [
  { id: "LOG-901", timestamp: "2026-06-24 14:30:12", actor: "Dr. Siti Rahimah", role: "Lecturer", action: "Finalised Carry Marks", subjectCode: "BCS315" },
  { id: "LOG-902", timestamp: "2026-06-24 11:15:00", actor: "Dr. Ahmad Zulkifli", role: "Lecturer", action: "Updated Test 2 Marks", subjectCode: "BCS101" },
  { id: "LOG-903", timestamp: "2026-06-23 16:45:22", actor: "Admin System", role: "System", action: "Automated Submission Reminder Sent", subjectCode: "BCS420" },
  { id: "LOG-904", timestamp: "2026-06-22 10:10:05", actor: "Khairul Anuar (Student)", role: "Student", action: "Submitted Mark Query / Dispute", subjectCode: "BCS203" },
];
