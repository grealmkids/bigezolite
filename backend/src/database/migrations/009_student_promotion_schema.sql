-- ===========================================================
-- Bigezo Student Promotion & Enrollment Schema (Version 1.4)
-- Purpose: Support term-based enrollment, year-over-year promotion, and multi-school tracks
-- ===========================================================

BEGIN;

-- -----------------------------------------------------------
-- STEP 1: CREATE CLASSES TABLE (Standardized Class List)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS classes (
  class_id SERIAL PRIMARY KEY,
  school_type VARCHAR(100) NOT NULL, -- e.g., 'Primary (Local)'
  class_name VARCHAR(50) NOT NULL, -- e.g., 'P.1'
  rank_order INT NOT NULL, -- e.g., 1 for P.1, 2 for P.2 (For auto-promotion)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_class_type_name UNIQUE(school_type, class_name)
);

-- Seed Initial Classes (Based on ClassCategorizationService)
-- Primary (Local)
INSERT INTO classes (school_type, class_name, rank_order) VALUES
('Primary (Local)', 'P.1', 1),
('Primary (Local)', 'P.2', 2),
('Primary (Local)', 'P.3', 3),
('Primary (Local)', 'P.4', 4),
('Primary (Local)', 'P.5', 5),
('Primary (Local)', 'P.6', 6),
('Primary (Local)', 'P.7', 7)
ON CONFLICT DO NOTHING;

-- Nursery
INSERT INTO classes (school_type, class_name, rank_order) VALUES
('Nursery', 'Baby', 1),
('Nursery', 'Middle', 2),
('Nursery', 'Top', 3)
ON CONFLICT DO NOTHING;

-- Secondary (Local)
INSERT INTO classes (school_type, class_name, rank_order) VALUES
('Secondary (Local)', 'S.1', 1),
('Secondary (Local)', 'S.2', 2),
('Secondary (Local)', 'S.3', 3),
('Secondary (Local)', 'S.4', 4),
('Secondary (Local)', 'S.5', 5),
('Secondary (Local)', 'S.6', 6)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------
-- STEP 2: CREATE TERM_ENROLLMENTS TABLE (The Ledger)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS term_enrollments (
  enrollment_id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  school_id INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE, -- Performance optimization & multi-school safety
  class_id INT REFERENCES classes(class_id),
  academic_year INT NOT NULL, -- e.g., 2025
  term INT NOT NULL, -- 1, 2, or 3
  status VARCHAR(20) DEFAULT 'Active', -- Active, Promoted, Repeated, Left
  is_current BOOLEAN DEFAULT FALSE, -- Flag to identify the student's *latest* status for quick queries
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_student_term_enrollment UNIQUE(student_id, academic_year, term)
);

-- Index for fast "Get Students in P.1" queries
CREATE INDEX IF NOT EXISTS idx_term_enrollments_current ON term_enrollments(school_id, academic_year, term, is_current);

COMMIT;
