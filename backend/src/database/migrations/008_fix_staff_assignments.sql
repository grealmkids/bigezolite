-- ===========================================================
-- MIGRATION: 008_fix_staff_assignments
-- Purpose: Change class/subject assignment tables to use VARCHAR for class names
--          to match the rest of the application (Marks/Student modules).
--          This drops existing assignment data.
-- ===========================================================

BEGIN;

-- 1. Drop existing tables if they exist
DROP TABLE IF EXISTS staff_subject_assignments;
DROP TABLE IF EXISTS staff_class_assignments;

-- 2. Re-create Staff Subject Assignments Table
-- Changed class_level_id (INT) -> class_level (VARCHAR)
CREATE TABLE staff_subject_assignments (
    assignment_id SERIAL PRIMARY KEY,
    staff_id INT NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
    class_level VARCHAR(50) NOT NULL, -- e.g. "P.1", "S.4"
    subject_id INT NOT NULL, -- References config_subjects(subject_id) conceptually, but we keep loose coupling or FK if possible. 
    -- Actually, config_subjects exists in 006. We can try to reference it if we trust it exists.
    -- But subjects are school-specific. 
    -- Let's keep it as INT for now but it should ideally reference config_subjects.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_staff_subject_assignment UNIQUE (staff_id, class_level, subject_id)
);

CREATE INDEX idx_staff_subj_assign_staff ON staff_subject_assignments(staff_id);

-- 3. Re-create Staff Class Assignments Table (For Class Teachers)
-- Changed class_id (INT) -> class_name (VARCHAR)
CREATE TABLE staff_class_assignments (
    assignment_id SERIAL PRIMARY KEY,
    staff_id INT NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
    class_name VARCHAR(50) NOT NULL, -- e.g. "P.1", "Year 7"
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_class_teacher_assignment UNIQUE (class_name, staff_id) -- Changed constraint: actually strict rule is "One class teacher per class".
    -- Schema 007 said: CONSTRAINT unique_class_teacher_assignment UNIQUE (class_id)
    -- So we should keep UNIQUE(class_name) to enforce one teacher per class?
    -- PRD: "Enforces: One Class Teacher per Class."
    -- Yes.
);

-- Ensure only one teacher per class_name (within the school? Wait, assignments table doesn't have school_id? 
-- staff_id implies school. But if multiple schools have "P.1", unique(class_name) would be GLOBAL if not scoped.
-- ERROR: This table is global. "P.1" exists in School A and School B.
-- If I put UNIQUE(class_name), School B cannot have a P.1 teacher if School A has one.
-- THIS IS A BUG IN THE ORIGINAL SCHEMA TOO (though original used IDs which might be unique? No, 007 assumed meaningless IDs).
-- WE MUST ADD SCHOOL_ID or depend on staff_id?
-- Queries are scoped by school. But DB constraint needs to be scoped.
-- The previous schema `staff_class_assignments` didn't have `school_id`.
-- `staff_subject_assignments` didn't either.
-- This is risky.
-- However, if `class_name` is just "P.1", we definitely need `school_id` in the table to enforce uniqueness PER SCHOOL.
-- OR we don't enforce uniqueness at DB level blindly on text.
-- But `staff` has `school_id`. 
-- We can add `school_id` to these tables to allow proper unique constraints.
-- Let's add `school_id` to both tables and FK to schools. It makes data integrity much better.

-- Re-doing with school_id.

DROP TABLE IF EXISTS staff_class_assignments; -- Just to be safe in script text
DROP TABLE IF EXISTS staff_subject_assignments;

CREATE TABLE staff_subject_assignments (
    assignment_id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    staff_id INT NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
    class_level VARCHAR(50) NOT NULL, 
    subject_id INT NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_staff_subject_assignment UNIQUE (school_id, staff_id, class_level, subject_id)
);
CREATE INDEX idx_staff_subj_assign_staff ON staff_subject_assignments(staff_id);

CREATE TABLE staff_class_assignments (
    assignment_id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    staff_id INT NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
    class_name VARCHAR(50) NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_class_teacher_per_school_class UNIQUE (school_id, class_name) -- One teacher per class per school
);
CREATE INDEX idx_staff_class_assign_staff ON staff_class_assignments(staff_id);

COMMIT;
