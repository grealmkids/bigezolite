-- Migration: Fix registration number constraint to allow duplicates across schools
-- Date: 2025-10-24
-- Description: Change reg_number from globally unique to unique per school_id

-- Step 1: Drop the existing UNIQUE constraint on reg_number
-- The constraint name might be 'students_reg_number_key' (default) or different
-- Use \d students in psql to find the exact name if this fails
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_reg_number_key;

-- Step 2: Add composite UNIQUE constraint (reg_number, school_id)
-- This allows same reg_number in different schools, but unique within each school
ALTER TABLE students ADD CONSTRAINT students_reg_number_school_unique 
    UNIQUE (reg_number, school_id);

-- Optional: Add index for performance if not automatically created
-- PostgreSQL automatically creates index for UNIQUE constraints, so this may not be needed
-- CREATE INDEX IF NOT EXISTS idx_students_reg_number_school ON students(reg_number, school_id);

-- Verification query (run after migration to check constraint)
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'students' AND constraint_type = 'UNIQUE';
