-- ===========================================================
-- Bigezo SAR Module Migration (Version 1.3)
-- Purpose: Implement flexible results, reporting, and bulk upload structure
-- Target: PostgreSQL
-- ===========================================================

BEGIN;

-- -----------------------------------------------------------
-- STEP 1: MODIFY EXISTING STUDENTS TABLE
-- Add LIN (National Identification Number) for scalability/future compliance
-- -----------------------------------------------------------

ALTER TABLE students 
ADD COLUMN IF NOT EXISTS lin_number VARCHAR(255) UNIQUE;

-- -----------------------------------------------------------
-- STEP 2: CREATE CORE ENUMS (If not already defined)
-- -----------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subject_type') THEN
        CREATE TYPE subject_type AS ENUM ('Compulsory', 'Elective', 'International-Custom');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_type') THEN
        CREATE TYPE assessment_type AS ENUM ('Formative', 'Summative', 'Mixed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'curriculum_type') THEN
        CREATE TYPE curriculum_type AS ENUM ('Nursery', 'Primary-Local', 'Secondary-LSC', 'International');
    END IF;
END
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------
-- STEP 3: CREATE MASTER NCDC REFERENCE TABLE (Static Data)
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS ref_ncdc_lsc_subjects (
    ncdc_ref_id SERIAL PRIMARY KEY,
    subject_name VARCHAR(255) NOT NULL UNIQUE,
    s1_s2_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
    s3_s4_mandatory BOOLEAN NOT NULL DEFAULT FALSE
);

-- -----------------------------------------------------------
-- STEP 4: CREATE CONFIGURATION TABLES (Flexible Per School)
-- -----------------------------------------------------------

-- 4.1. Grading Scales
CREATE TABLE IF NOT EXISTS config_grading_scales (
    scale_id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    grade_letter VARCHAR(10) NOT NULL,
    descriptor TEXT,
    min_score_percent NUMERIC(5, 2) NOT NULL,
    CONSTRAINT unique_grade_def_per_school UNIQUE (school_id, grade_letter)
);

-- 4.2. School Settings
CREATE TABLE IF NOT EXISTS config_school_settings (
    setting_id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE UNIQUE,
    curriculum_type curriculum_type NOT NULL,
    grading_scale_ref INT REFERENCES config_grading_scales(scale_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.3. Subjects
CREATE TABLE IF NOT EXISTS config_subjects (
    subject_id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    subject_name VARCHAR(255) NOT NULL,
    school_level VARCHAR(50) NOT NULL,
    subject_type subject_type NOT NULL,
    ncdc_reference_name VARCHAR(255),
    max_selections_allowed INT DEFAULT 1,
    CONSTRAINT unique_school_subject_level UNIQUE (school_id, subject_name, school_level)
);

-- 4.4. Exam Sets
CREATE TABLE IF NOT EXISTS config_exam_sets (
    exam_set_id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    set_name VARCHAR(100) NOT NULL,
    class_level VARCHAR(50) NOT NULL,
    term INT NOT NULL,
    year INT NOT NULL,
    assessment_type assessment_type NOT NULL,
    CONSTRAINT unique_exam_set_context UNIQUE (school_id, set_name, class_level, term, year)
);

-- 4.5. Assessment Elements
CREATE TABLE IF NOT EXISTS config_assessment_elements (
    element_id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    subject_id INT NOT NULL REFERENCES config_subjects(subject_id) ON DELETE CASCADE,
    exam_set_id INT NOT NULL REFERENCES config_exam_sets(exam_set_id) ON DELETE CASCADE,
    element_name VARCHAR(100) NOT NULL,
    max_score INT NOT NULL,
    contributing_weight_percent NUMERIC(5, 2) NOT NULL
);

-- 4.6. Holistic Metrics
CREATE TABLE IF NOT EXISTS config_holistic_metrics (
    metric_id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    metric_type VARCHAR(50),
    metric_name VARCHAR(255) NOT NULL,
    CONSTRAINT unique_metric_name_per_school UNIQUE (school_id, metric_name)
);

-- -----------------------------------------------------------
-- STEP 5: CREATE TRANSACTIONAL AND RESULTS TABLES
-- -----------------------------------------------------------

-- 5.1. Results Header
CREATE TABLE IF NOT EXISTS results_header (
    header_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    school_id INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    subject_id INT NOT NULL REFERENCES config_subjects(subject_id) ON DELETE CASCADE,
    term INT NOT NULL,
    year INT NOT NULL,
    CONSTRAINT unique_result_per_student_subject UNIQUE (student_id, subject_id, term, year)
);

-- 5.2. Exam Entries
CREATE TABLE IF NOT EXISTS results_exam_entries (
    exam_entry_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    subject_id INT NOT NULL REFERENCES config_subjects(subject_id) ON DELETE CASCADE,
    exam_set_id INT NOT NULL REFERENCES config_exam_sets(exam_set_id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'Pending Entry',
    CONSTRAINT unique_student_subject_exam_set UNIQUE (student_id, subject_id, exam_set_id)
);

-- 5.3. Results Entry
CREATE TABLE IF NOT EXISTS results_entry (
    entry_id SERIAL PRIMARY KEY,
    exam_entry_id INT NOT NULL REFERENCES results_exam_entries(exam_entry_id) ON DELETE CASCADE,
    element_id INT NOT NULL REFERENCES config_assessment_elements(element_id) ON DELETE CASCADE,
    score_obtained NUMERIC(5, 2) NOT NULL,
    max_score_at_entry INT NOT NULL,
    entered_by_user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_element_score UNIQUE (exam_entry_id, element_id)
);

-- 5.4. Reports Summary
CREATE TABLE IF NOT EXISTS reports_summary (
    summary_id SERIAL PRIMARY KEY,
    header_id INT NOT NULL REFERENCES results_header(header_id) ON DELETE CASCADE UNIQUE,
    total_percentage_score NUMERIC(5, 2) NOT NULL,
    final_grade_ref INT REFERENCES config_grading_scales(scale_id),
    weighted_formative_score NUMERIC(5, 2),
    weighted_summative_score NUMERIC(5, 2),
    class_teacher_comment TEXT,
    head_teacher_comment TEXT
);

-- 5.5. Holistic Feedback
CREATE TABLE IF NOT EXISTS reports_holistic_feedback (
    feedback_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    school_id INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    term INT NOT NULL,
    year INT NOT NULL,
    metric_id INT NOT NULL REFERENCES config_holistic_metrics(metric_id) ON DELETE CASCADE,
    rating VARCHAR(50),
    CONSTRAINT unique_holistic_rating UNIQUE (student_id, metric_id, term, year)
);

-- 5.6. Report Documents
CREATE TABLE IF NOT EXISTS report_documents (
    doc_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    school_id INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    term INT NOT NULL,
    year INT NOT NULL,
    file_path TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_report_document UNIQUE (student_id, term, year)
);

-- -----------------------------------------------------------
-- STEP 6: CREATE INDEXES FOR PERFORMANCE
-- -----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_config_subjects_school_level ON config_subjects (school_id, school_level);
CREATE INDEX IF NOT EXISTS idx_results_exam_entries_student_set ON results_exam_entries (student_id, exam_set_id);
CREATE INDEX IF NOT EXISTS idx_reports_summary_header ON reports_summary (header_id);
CREATE INDEX IF NOT EXISTS idx_holistic_feedback_student ON reports_holistic_feedback (student_id);

COMMIT;
