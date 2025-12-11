-- ===========================================================
-- Bigezo Data Migration: Students to Term Enrollments (Version 1.0)
-- Purpose: Move existing "Flat" student class data into the new "Historical" structure
-- Safe Execution: Does NOT delete old data. Can be run safely.
-- ===========================================================

BEGIN;

-- -----------------------------------------------------------
-- STEP 1: Insert Students into term_enrollments
-- Logic:
-- 1. Find the matching 'class_id' for each student based on their text 'class_name'
-- 2. Assume 'Current Year' is the student's 'year_enrolled' (or default to current year if NULL)
--    NOTE: Users might need to bulk-update years if 'year_enrolled' was just registration year, but this is the best safe guess.
-- 3. Set Term = 1 (Default for legacy migration)
-- 4. Set is_current = TRUE
-- -----------------------------------------------------------

INSERT INTO term_enrollments (student_id, school_id, class_id, academic_year, term, status, is_current)
SELECT 
    s.student_id,
    s.school_id,
    c.class_id,
    COALESCE(s.year_enrolled, EXTRACT(YEAR FROM NOW())::INT) as academic_year, -- Default to current year if null
    1 as term, -- Default term 1 for migration
    s.student_status, -- Preserve 'Active', 'Inactive', etc.
    TRUE as is_current
FROM students s
JOIN classes c ON LOWER(c.class_name) = LOWER(s.class_name) -- Case-insensitive match on text class name
ON CONFLICT (student_id, academic_year, term) DO NOTHING; -- Avoid duplicates if run twice

-- -----------------------------------------------------------
-- STEP 2: Verify & Log
-- -----------------------------------------------------------
-- You can run a SELECT count(*) afterwards to verify.

COMMIT;
