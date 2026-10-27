export type Assessment = {
  name: string;
  assessment_type: string;
  score: number | null;
  maximum: number;
  carry_contribution: number | null;
  weight: number;
};

export type SubjectResult = {
  offering_id: string;
  code: string;
  name: string;
  lecturer: string;
  group: string;
  carry_mark: number | null;
  carry_maximum: number;
  eligible: boolean | null;
  eligible_threshold: number;
  is_finalised: boolean;
  last_updated: string | null;
  assessments: Assessment[];
};

export type Student = {
  matrix_number: string;
  name: string;
  programme: string;
  faculty: string;
  semester: string | null;
  semester_code: string | null;
  academic_advisor: string | null;
};

export type StudentNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export type StudentPortalPayload = {
  student: Student | null;
  subjects: SubjectResult[];
  notifications_enabled: boolean | null;
  notifications: StudentNotification[];
};
