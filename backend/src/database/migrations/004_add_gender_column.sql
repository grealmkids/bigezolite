-- Migration: Add gender column to students table
-- Created: 2025-10-24

-- Add gender column as VARCHAR with default 'Not Specified'
ALTER TABLE students 
ADD COLUMN gender VARCHAR(20) DEFAULT 'Not Specified';

-- Optional: Add a check constraint to limit values
ALTER TABLE students
ADD CONSTRAINT gender_check CHECK (gender IN ('Boy', 'Girl', 'Not Specified'));

-- Create index for gender column (useful for analytics queries)
CREATE INDEX idx_students_gender ON students(gender);
