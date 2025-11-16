export type SubjectType = 'Compulsory' | 'Elective' | 'International-Custom';
export type AssessmentType = 'Formative' | 'Summative' | 'Mixed';
export type CurriculumType = 'Nursery' | 'Primary-Local' | 'Secondary-LSC' | 'International';

export interface GradingScale {
  scale_id: number;
  school_id: number;
  grade_letter: string;
  descriptor?: string;
  min_score_percent: number;
}

export interface SchoolSetting {
  setting_id: number;
  school_id: number;
  curriculum_type: CurriculumType;
  grading_scale_ref?: number;
  created_at: Date;
}

export interface Subject {
  subject_id: number;
  school_id: number;
  subject_name: string;
  school_level: string;
  subject_type: SubjectType;
  ncdc_reference_name?: string;
  max_selections_allowed: number;
}

export interface ExamSet {
  exam_set_id: number;
  school_id: number;
  set_name: string;
  class_level: string;
  term: number;
  year: number;
  assessment_type: AssessmentType;
}

export interface AssessmentElement {
  element_id: number;
  school_id: number;
  subject_id: number;
  exam_set_id: number;
  element_name: string;
  max_score: number;
  contributing_weight_percent: number;
}

export interface HolisticMetric {
  metric_id: number;
  school_id: number;
  metric_type: string;
  metric_name: string;
}

export interface ResultsHeader {
  header_id: number;
  student_id: number;
  school_id: number;
  subject_id: number;
  term: number;
  year: number;
}

export interface ExamEntry {
  exam_entry_id: number;
  student_id: number;
  subject_id: number;
  exam_set_id: number;
  status: string;
}

export interface ResultEntry {
  entry_id: number;
  exam_entry_id: number;
  element_id: number;
  score_obtained: number;
  max_score_at_entry: number;
  entered_by_user_id?: number;
  created_at: Date;
}

export interface ReportSummary {
  summary_id: number;
  header_id: number;
  total_percentage_score: number;
  final_grade_ref?: number;
  weighted_formative_score?: number;
  weighted_summative_score?: number;
  class_teacher_comment?: string;
  head_teacher_comment?: string;
}

export interface HolisticFeedback {
  feedback_id: number;
  student_id: number;
  school_id: number;
  term: number;
  year: number;
  metric_id: number;
  rating?: string;
}

export interface ReportDocument {
  doc_id: number;
  student_id: number;
  school_id: number;
  term: number;
  year: number;
  file_path: string;
  generated_at: Date;
}

export interface NCDCSubject {
  ncdc_ref_id: number;
  subject_name: string;
  s1_s2_mandatory: boolean;
  s3_s4_mandatory: boolean;
}

export interface CreateExamSetRequest {
  school_id: number;
  set_name: string;
  class_level: string;
  term: number;
  year: number;
  assessment_type: AssessmentType;
  subjects: {
    subject_id: number;
    elements: {
      element_name: string;
      max_score: number;
      contributing_weight_percent: number;
    }[];
  }[];
}

export interface BulkMarkEntry {
  student_identifier: string;
  identifier_type: 'reg_number' | 'lin_number';
  marks: {
    element_id: number;
    score_obtained: number;
  }[];
}

export interface SubjectFilterParams {
  school_id: number;
  school_level: string;
}

export interface ReportGenerationRequest {
  student_id: number;
  school_id: number;
  term: number;
  year: number;
}
