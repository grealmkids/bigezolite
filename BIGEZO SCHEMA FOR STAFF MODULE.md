-- ===================================================================
-- BIGEZO: STAFF MODULE SCHEMA (Implemented)
-- Version: 1.1
-- Purpose: create staff, RBAC support, assignments
-- DB: PostgreSQL
-- ===================================================================

BEGIN;

-- -----------------------------------------------------------
-- STEP 1: Create required ENUM types
-- -----------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role') THEN
    CREATE TYPE staff_role AS ENUM ('Teacher', 'Class Teacher', 'Accountant', 'IT', 'Canteen', 'Other');
  END IF;
END$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------
-- STEP 2: staff table (per-school staff)
-- - email is globally unique
-- - password is nullable (supports Google login)
-- - photo_url for Backblaze integration
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
  staff_id            SERIAL PRIMARY KEY,
  school_id           INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  first_name          VARCHAR(120)          NOT NULL,
  last_name           VARCHAR(120)          NOT NULL,
  email               VARCHAR(200)          NOT NULL,
  phone               VARCHAR(50)           NOT NULL,
  gender              VARCHAR(20)           CHECK (gender IN ('Male', 'Female')),
  role                staff_role            NOT NULL,
  photo_url           TEXT,
  password_hash       TEXT,
  google_uid          TEXT,
  allow_password_login BOOLEAN DEFAULT TRUE,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT staff_email_unique UNIQUE (email)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_staff_school_id ON staff(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);

-- -----------------------------------------------------------
-- STEP 3: staff_password_resets table
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_password_resets (
    id SERIAL PRIMARY KEY,
    staff_id INT NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_pwd_reset_token ON staff_password_resets(token);

-- -----------------------------------------------------------
-- STEP 4: teacher / staff assignment tables
-- -----------------------------------------------------------

-- 4.1 Staff <-> Subject assignment (teacher to subject)
CREATE TABLE IF NOT EXISTS staff_subject_assignments (
  assignment_id       SERIAL PRIMARY KEY,
  staff_id            INT NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
  class_level_id      INT NOT NULL, -- References class_levels table
  subject_id          INT NOT NULL, -- References subjects table
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_staff_subject_assignment UNIQUE (staff_id, class_level_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_subj_assign_staff ON staff_subject_assignments(staff_id);

-- 4.2 Staff <-> Class assignment (Class Teacher)
CREATE TABLE IF NOT EXISTS staff_class_assignments (
  assignment_id       SERIAL PRIMARY KEY,
  staff_id            INT NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
  class_id            INT NOT NULL, -- References classes table
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_class_teacher_assignment UNIQUE (class_id) -- One class teacher per class
);

CREATE INDEX IF NOT EXISTS idx_staff_class_assign_staff ON staff_class_assignments(staff_id);

-- -----------------------------------------------------------
-- STEP 5: Future / Planned Tables (Not yet implemented)
-- -----------------------------------------------------------

-- 5.1 storagedb table (per-school Backblaze credentials)
-- CREATE TABLE IF NOT EXISTS storagedb (
--   storage_id          BIGSERIAL PRIMARY KEY,
--   school_id           INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE UNIQUE,
--   provider             VARCHAR(50) NOT NULL DEFAULT 'Backblaze',
--   b2_key_id           TEXT NOT NULL,
--   b2_application_key  TEXT NOT NULL,
--   bucket_name         TEXT NOT NULL,
--   bucket_region       TEXT,
--   max_file_size_bytes INT DEFAULT 5242880,
--   is_active           BOOLEAN DEFAULT TRUE,
--   created_at          TIMESTAMPTZ DEFAULT NOW(),
--   updated_at          TIMESTAMPTZ DEFAULT NOW()
-- );

-- 5.2 Audit log for staff actions
-- CREATE TABLE IF NOT EXISTS staff_audit_log (
--   log_id              BIGSERIAL PRIMARY KEY,
--   staff_id            BIGINT,
--   action_type         VARCHAR(100) NOT NULL,
--   details             JSONB DEFAULT '{}'::JSONB,
--   created_at          TIMESTAMPTZ DEFAULT NOW()
-- );

COMMIT;
