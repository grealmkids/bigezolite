-- ===========================================================
-- MIGRATION: 007_create_staff_module
-- Purpose: Create tables for Staff Management Module
-- ===========================================================

BEGIN;

-- 1. Create Staff Roles Enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role') THEN
        CREATE TYPE staff_role AS ENUM ('Teacher', 'Class Teacher', 'Accountant', 'IT', 'Canteen', 'Other');
    END IF;
END$$;

-- 2. Create Staff Table
CREATE TABLE IF NOT EXISTS staff (
    staff_id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    gender VARCHAR(20) CHECK (gender IN ('Male', 'Female')),
    email VARCHAR(200) NOT NULL, -- Enforcing global uniqueness for simplicity as per PRD
    phone VARCHAR(50) NOT NULL,
    role staff_role NOT NULL,
    photo_url TEXT,
    password_hash TEXT,
    google_uid TEXT,
    allow_password_login BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT staff_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_staff_school_id ON staff(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);

-- 3. Create Staff Password Resets Table
CREATE TABLE IF NOT EXISTS staff_password_resets (
    id SERIAL PRIMARY KEY,
    staff_id INT NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_pwd_reset_token ON staff_password_resets(token);

-- 4. Create Staff Subject Assignments Table
CREATE TABLE IF NOT EXISTS staff_subject_assignments (
    assignment_id SERIAL PRIMARY KEY,
    staff_id INT NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
    class_level_id INT NOT NULL, -- Assuming class_levels table exists or will be referenced by ID
    subject_id INT NOT NULL, -- Assuming subjects table exists or will be referenced by ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_staff_subject_assignment UNIQUE (staff_id, class_level_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_subj_assign_staff ON staff_subject_assignments(staff_id);

-- 5. Create Staff Class Assignments Table (For Class Teachers)
CREATE TABLE IF NOT EXISTS staff_class_assignments (
    assignment_id SERIAL PRIMARY KEY,
    staff_id INT NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
    class_id INT NOT NULL, -- Assuming classes table exists or will be referenced by ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_class_teacher_assignment UNIQUE (class_id) -- One class teacher per class
);

CREATE INDEX IF NOT EXISTS idx_staff_class_assign_staff ON staff_class_assignments(staff_id);

COMMIT;
