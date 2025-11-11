\-- \===========================================================  
\-- Bigezo SAR Module Migration (Version 1.3)  
\-- Purpose: Implement flexible results, reporting, and bulk upload structure  
\-- Target: PostgreSQL (PgAdmin)  
\-- \===========================================================

BEGIN;

\-- \-----------------------------------------------------------  
\-- STEP 1: MODIFY EXISTING STUDENTS TABLE  
\-- Add LIN (National Identification Number) for scalability/future compliance  
\-- \-----------------------------------------------------------

ALTER TABLE students  
ADD COLUMN lin\_number VARCHAR(255) UNIQUE;

\-- We keep lin\_number nullable since not all children have it yet,  
\-- but we enforce uniqueness if a value is provided.

\-- \-----------------------------------------------------------  
\-- STEP 2: CREATE CORE ENUMS (If not already defined)  
\-- \-----------------------------------------------------------

\-- Subject Type for Compulsory/Elective distinction  
DO $$  
BEGIN  
    IF NOT EXISTS (SELECT 1 FROM pg\_type WHERE typname \= 'subject\_type') THEN  
        CREATE TYPE subject\_type AS ENUM ('Compulsory', 'Elective', 'International-Custom');  
    END IF;  
    IF NOT EXISTS (SELECT 1 FROM pg\_type WHERE typname \= 'assessment\_type') THEN  
        CREATE TYPE assessment\_type AS ENUM ('Formative', 'Summative', 'Mixed');  
    END IF;  
    IF NOT EXISTS (SELECT 1 FROM pg\_type WHERE typname \= 'curriculum\_type') THEN  
        CREATE TYPE curriculum\_type AS ENUM ('Nursery', 'Primary-Local', 'Secondary-LSC', 'International');  
    END IF;  
END  
$$ LANGUAGE plpgsql;

\-- \-----------------------------------------------------------  
\-- STEP 3: CREATE MASTER NCDC REFERENCE TABLE (Static Data)  
\-- This table is for backend compliance checks and template generation  
\-- \-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS ref\_ncdc\_lsc\_subjects (  
    ncdc\_ref\_id SERIAL PRIMARY KEY,  
    subject\_name VARCHAR(255) NOT NULL UNIQUE,  
    s1\_s2\_mandatory BOOLEAN NOT NULL DEFAULT FALSE,  
    s3\_s4\_mandatory BOOLEAN NOT NULL DEFAULT FALSE  
);

\-- Note: Initial data population for NCDC LSC subjects must follow this table creation.  
\-- Example subjects based on source: English, Mathematics, History & Political Education, etc.

\-- \-----------------------------------------------------------  
\-- STEP 4: CREATE CONFIGURATION TABLES (Flexible Per School)  
\-- \-----------------------------------------------------------

\-- 4.1. Grading Scales (Supports 8-level, 5-level, or custom international scales)  
CREATE TABLE IF NOT EXISTS config\_grading\_scales (  
    scale\_id SERIAL PRIMARY KEY,  
    school\_id INT NOT NULL REFERENCES schools(school\_id) ON DELETE CASCADE,  
    grade\_letter VARCHAR(10) NOT NULL,  
    descriptor TEXT, \-- e.g., 'Exceptional', 'Satisfactory'  
    min\_score\_percent NUMERIC(5, 2\) NOT NULL,  
    \-- Unique constraint ensures only one boundary definition per grade letter per school  
    CONSTRAINT unique\_grade\_def\_per\_school UNIQUE (school\_id, grade\_letter)  
);

\-- 4.2. School Settings (Defines the curriculum context)  
CREATE TABLE IF NOT EXISTS config\_school\_settings (  
    setting\_id SERIAL PRIMARY KEY,  
    school\_id INT NOT NULL REFERENCES schools(school\_id) ON DELETE CASCADE UNIQUE,  
    curriculum\_type curriculum\_type NOT NULL, \-- References the ENUM created above  
    grading\_scale\_ref INT REFERENCES config\_grading\_scales(scale\_id) ON DELETE SET NULL, \-- Default scale used  
    created\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- 4.3. Subjects (Compulsory/Elective status defined per school and level)  
CREATE TABLE IF NOT EXISTS config\_subjects (  
    subject\_id SERIAL PRIMARY KEY,  
    school\_id INT NOT NULL REFERENCES schools(school\_id) ON DELETE CASCADE,  
    subject\_name VARCHAR(255) NOT NULL,  
    school\_level VARCHAR(50) NOT NULL, \-- e.g., 'P7', 'S3'  
    subject\_type subject\_type NOT NULL, \-- Differentiates Compulsory/Elective  
    ncdc\_reference\_name VARCHAR(255), \-- Links back to official NCDC name (if applicable)  
    max\_selections\_allowed INT DEFAULT 1, \-- Controls elective limits (S3/S4: max 2\)  
    \-- Ensures unique subject definition within a specific school and level  
    CONSTRAINT unique\_school\_subject\_level UNIQUE (school\_id, subject\_name, school\_level)  
);

\-- 4.4. Exam Sets (Defines "Mid Term Exams" entity for bulk entry)  
CREATE TABLE IF NOT EXISTS config\_exam\_sets (  
    exam\_set\_id SERIAL PRIMARY KEY,  
    school\_id INT NOT NULL REFERENCES schools(school\_id) ON DELETE CASCADE,  
    set\_name VARCHAR(100) NOT NULL, \-- e.g., 'Mid Term Exams', 'End of Term 1' \[User Request\]  
    class\_level VARCHAR(50) NOT NULL, \-- Targeted class (e.g., 'S3G')  
    term INT NOT NULL,  
    year INT NOT NULL,  
    assessment\_type assessment\_type NOT NULL,  
    \-- Ensures unique exam set per context  
    CONSTRAINT unique\_exam\_set\_context UNIQUE (school\_id, set\_name, class\_level, term, year)  
);

\-- 4.5. Assessment Elements (Granular input fields for marks)  
CREATE TABLE IF NOT EXISTS config\_assessment\_elements (  
    element\_id SERIAL PRIMARY KEY,  
    school\_id INT NOT NULL REFERENCES schools(school\_id) ON DELETE CASCADE,  
    subject\_id INT NOT NULL REFERENCES config\_subjects(subject\_id) ON DELETE CASCADE,  
    exam\_set\_id INT NOT NULL REFERENCES config\_exam\_sets(exam\_set\_id) ON DELETE CASCADE,  
    element\_name VARCHAR(100) NOT NULL, \-- e.g., 'Paper 1 Mark', 'Project Score'  
    max\_score INT NOT NULL,  
    contributing\_weight\_percent NUMERIC(5, 2\) NOT NULL \-- Critical for calculation logic (80/20, 60/40)  
);

\-- 4.6. Holistic Metrics (Generic Skills, Values, Life Skills)  
CREATE TABLE IF NOT EXISTS config\_holistic\_metrics (  
    metric\_id SERIAL PRIMARY KEY,  
    school\_id INT NOT NULL REFERENCES schools(school\_id) ON DELETE CASCADE,  
    metric\_type VARCHAR(50), \-- e.g., 'Value', 'Generic Skill', 'Life Skill'  
    metric\_name VARCHAR(255) NOT NULL, \-- e.g., 'Critical thinking and problem-solving'  
    \-- Ensures unique metric name per school  
    CONSTRAINT unique\_metric\_name\_per\_school UNIQUE (school\_id, metric\_name)  
);

\-- \-----------------------------------------------------------  
\-- STEP 5: CREATE TRANSACTIONAL AND RESULTS TABLES  
\-- \-----------------------------------------------------------

\-- 5.1. Results Header (Defines the context for a student's termly report)  
CREATE TABLE IF NOT EXISTS results\_header (  
    header\_id SERIAL PRIMARY KEY,  
    student\_id INT NOT NULL REFERENCES students(student\_id) ON DELETE CASCADE,  
    school\_id INT NOT NULL REFERENCES schools(school\_id) ON DELETE CASCADE,  
    subject\_id INT NOT NULL REFERENCES config\_subjects(subject\_id) ON DELETE CASCADE,  
    term INT NOT NULL,  
    year INT NOT NULL,  
    \-- Ensures a student only has one final report header per subject per term/year  
    CONSTRAINT unique\_result\_per\_student\_subject UNIQUE (student\_id, subject\_id, term, year)  
);

\-- 5.2. Exam Entries (Pre-assigned records when an Exam Set is created)  
CREATE TABLE IF NOT EXISTS results\_exam\_entries (  
    exam\_entry\_id SERIAL PRIMARY KEY,  
    student\_id INT NOT NULL REFERENCES students(student\_id) ON DELETE CASCADE,  
    subject\_id INT NOT NULL REFERENCES config\_subjects(subject\_id) ON DELETE CASCADE,  
    exam\_set\_id INT NOT NULL REFERENCES config\_exam\_sets(exam\_set\_id) ON DELETE CASCADE,  
    status VARCHAR(50) DEFAULT 'Pending Entry',  
    \-- Ensures a student/subject combination is only assessed once per exam set  
    CONSTRAINT unique\_student\_subject\_exam\_set UNIQUE (student\_id, subject\_id, exam\_set\_id)  
);

\-- 5.3. Results Entry (Stores the raw, progressive marks from bulk upload)  
CREATE TABLE IF NOT EXISTS results\_entry (  
    entry\_id SERIAL PRIMARY KEY,  
    exam\_entry\_id INT NOT NULL REFERENCES results\_exam\_entries(exam\_entry\_id) ON DELETE CASCADE,  
    element\_id INT NOT NULL REFERENCES config\_assessment\_elements(element\_id) ON DELETE CASCADE,  
    score\_obtained NUMERIC(5, 2\) NOT NULL,  
    max\_score\_at\_entry INT NOT NULL, \-- Snapshot of max score for historical accuracy  
    entered\_by\_user\_id INT REFERENCES users(user\_id) ON DELETE SET NULL, \-- Accountability/Audit Log  
    created\_at TIMESTAMPTZ DEFAULT NOW(),  
    \-- Ensures only one score for one element within a single exam entry context  
    CONSTRAINT unique\_element\_score UNIQUE (exam\_entry\_id, element\_id)  
);

\-- 5.4. Reports Summary (Cashed result of calculations)  
CREATE TABLE IF NOT EXISTS reports\_summary (  
    summary\_id SERIAL PRIMARY KEY,  
    header\_id INT NOT NULL REFERENCES results\_header(header\_id) ON DELETE CASCADE UNIQUE,  
    total\_percentage\_score NUMERIC(5, 2\) NOT NULL,  
    final\_grade\_ref INT REFERENCES config\_grading\_scales(scale\_id),  
    weighted\_formative\_score NUMERIC(5, 2), \-- 20% for LSC  
    weighted\_summative\_score NUMERIC(5, 2), \-- 80% for LSC  
    class\_teacher\_comment TEXT,  
    head\_teacher\_comment TEXT  
);

\-- 5.5. Holistic Feedback (Qualitative ratings/comments)  
CREATE TABLE IF NOT EXISTS reports\_holistic\_feedback (  
    feedback\_id SERIAL PRIMARY KEY,  
    student\_id INT NOT NULL REFERENCES students(student\_id) ON DELETE CASCADE,  
    school\_id INT NOT NULL REFERENCES schools(school\_id) ON DELETE CASCADE,  
    term INT NOT NULL,  
    year INT NOT NULL,  
    metric\_id INT NOT NULL REFERENCES config\_holistic\_metrics(metric\_id) ON DELETE CASCADE,  
    rating VARCHAR(50), \-- e.g., 'A', 'Very Good', 'Needs Improvement'  
    \-- Ensures unique rating for a specific metric for a student per term/year  
    CONSTRAINT unique\_holistic\_rating UNIQUE (student\_id, metric\_id, term, year)  
);

\-- 5.6. Report Documents (Metadata for generated PDFs)  
CREATE TABLE IF NOT EXISTS report\_documents (  
    doc\_id SERIAL PRIMARY KEY,  
    student\_id INT NOT NULL REFERENCES students(student\_id) ON DELETE CASCADE,  
    school\_id INT NOT NULL REFERENCES schools(school\_id) ON DELETE CASCADE,  
    term INT NOT NULL,  
    year INT NOT NULL,  
    file\_path TEXT NOT NULL,  
    generated\_at TIMESTAMPTZ DEFAULT NOW(),  
    CONSTRAINT unique\_report\_document UNIQUE (student\_id, term, year)  
);

\-- \-----------------------------------------------------------  
\-- STEP 6: CREATE INDEXES FOR PERFORMANCE  
\-- \-----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx\_config\_subjects\_school\_level ON config\_subjects (school\_id, school\_level);  
CREATE INDEX IF NOT EXISTS idx\_results\_exam\_entries\_student\_set ON results\_exam\_entries (student\_id, exam\_set\_id);  
CREATE INDEX IF NOT EXISTS idx\_reports\_summary\_header ON reports\_summary (header\_id);  
CREATE INDEX IF NOT EXISTS idx\_holistic\_feedback\_student ON reports\_holistic\_feedback (student\_id);

COMMIT;

