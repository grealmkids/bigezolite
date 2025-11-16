import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type SubjectType = 'Compulsory' | 'Elective' | 'International-Custom';
export type AssessmentType = 'Formative' | 'Summative' | 'Mixed';
export type CurriculumType = 'Nursery' | 'Primary-Local' | 'Secondary-LSC' | 'International';

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

export interface HolisticMetric {
  metric_id: number;
  school_id: number;
  metric_type: string;
  metric_name: string;
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

@Injectable({
  providedIn: 'root'
})
export class MarksService {
  private apiUrl = `${environment.apiUrl}/marks`;

  constructor(private http: HttpClient) {}

  getSubjects(schoolId: number, schoolLevel: string): Observable<Subject[]> {
    const params = new HttpParams()
      .set('school_id', schoolId.toString())
      .set('school_level', schoolLevel);
    return this.http.get<Subject[]>(`${this.apiUrl}/subjects`, { params });
  }

  createSubject(subject: Omit<Subject, 'subject_id'>): Observable<Subject> {
    return this.http.post<Subject>(`${this.apiUrl}/subjects`, subject);
  }

  updateSubject(subjectId: number, updates: Partial<Subject>): Observable<Subject> {
    return this.http.put<Subject>(`${this.apiUrl}/subjects/${subjectId}`, updates);
  }

  deleteSubject(subjectId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/subjects/${subjectId}`);
  }

  createExamSet(request: CreateExamSetRequest): Observable<ExamSet> {
    return this.http.post<ExamSet>(`${this.apiUrl}/exam-sets`, request);
  }

  getExamSets(schoolId: number, filters?: { term?: number; year?: number; class_level?: string }): Observable<ExamSet[]> {
    let params = new HttpParams().set('school_id', schoolId.toString());
    
    if (filters?.term) params = params.set('term', filters.term.toString());
    if (filters?.year) params = params.set('year', filters.year.toString());
    if (filters?.class_level) params = params.set('class_level', filters.class_level);

    return this.http.get<ExamSet[]>(`${this.apiUrl}/exam-sets`, { params });
  }

  getExamSetById(examSetId: number): Observable<ExamSet> {
    return this.http.get<ExamSet>(`${this.apiUrl}/exam-sets/${examSetId}`);
  }

  getAssessmentElements(examSetId: number): Observable<AssessmentElement[]> {
    return this.http.get<AssessmentElement[]>(`${this.apiUrl}/exam-sets/${examSetId}/elements`);
  }

  deleteExamSet(examSetId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/exam-sets/${examSetId}`);
  }

  bulkUploadMarks(examSetId: number, schoolId: number, entries: BulkMarkEntry[]): Observable<{ success: number; errors: any[] }> {
    return this.http.post<{ success: number; errors: any[] }>(`${this.apiUrl}/marks/bulk-upload`, {
      exam_set_id: examSetId,
      school_id: schoolId,
      entries
    });
  }

  getStudentMarks(studentId: number, examSetId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/marks/student/${studentId}/exam-set/${examSetId}`);
  }

  generateReport(studentId: number, schoolId: number, term: number, year: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reports/generate`, {
      student_id: studentId,
      school_id: schoolId,
      term,
      year
    });
  }

  getReportSummary(studentId: number, term: number, year: number): Observable<any> {
    const params = new HttpParams()
      .set('term', term.toString())
      .set('year', year.toString());
    return this.http.get<any>(`${this.apiUrl}/reports/summary/${studentId}`, { params });
  }

  saveHolisticFeedback(feedback: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reports/holistic-feedback`, feedback);
  }

  createGradingScale(scale: Omit<GradingScale, 'scale_id'>): Observable<GradingScale> {
    return this.http.post<GradingScale>(`${this.apiUrl}/config/grading-scales`, scale);
  }

  bulkCreateGradingScales(schoolId: number, scales: Omit<GradingScale, 'scale_id' | 'school_id'>[]): Observable<GradingScale[]> {
    return this.http.post<GradingScale[]>(`${this.apiUrl}/config/grading-scales/bulk`, {
      school_id: schoolId,
      scales
    });
  }

  getGradingScales(schoolId: number): Observable<GradingScale[]> {
    return this.http.get<GradingScale[]>(`${this.apiUrl}/config/grading-scales/${schoolId}`);
  }

  deleteGradingScale(scaleId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/config/grading-scales/${scaleId}`);
  }

  createOrUpdateSchoolSetting(setting: Omit<SchoolSetting, 'setting_id' | 'created_at'>): Observable<SchoolSetting> {
    return this.http.post<SchoolSetting>(`${this.apiUrl}/config/school-settings`, setting);
  }

  getSchoolSetting(schoolId: number): Observable<SchoolSetting> {
    return this.http.get<SchoolSetting>(`${this.apiUrl}/config/school-settings/${schoolId}`);
  }

  createHolisticMetric(metric: Omit<HolisticMetric, 'metric_id'>): Observable<HolisticMetric> {
    return this.http.post<HolisticMetric>(`${this.apiUrl}/config/holistic-metrics`, metric);
  }

  getHolisticMetrics(schoolId: number): Observable<HolisticMetric[]> {
    return this.http.get<HolisticMetric[]>(`${this.apiUrl}/config/holistic-metrics/${schoolId}`);
  }

  deleteHolisticMetric(metricId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/config/holistic-metrics/${metricId}`);
  }

  // New methods for Student Marks Viewer and Student Reports
  getExamSetResults(examSetId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/exam-sets/${examSetId}/results`);
  }

  getStudentExamResults(examSetId: number, studentId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/exam-sets/${examSetId}/student/${studentId}/results`);
  }

  generateStudentReportPDF(examSetId: number, studentId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/reports/${examSetId}/student/${studentId}/pdf`, { 
      responseType: 'blob' 
    });
  }

  getExamSetStudents(examSetId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/exam-sets/${examSetId}/students`);
  }

  getHolisticFeedback(studentId: number, schoolId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/feedback/holistic/${studentId}/${schoolId}`);
  }

  saveBulkHolisticFeedback(feedback: any[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/feedback/holistic/bulk`, { feedback });
  }
}
