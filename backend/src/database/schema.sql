-- Users Table: Stores individual user accounts
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    full_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schools Table: Stores organizational school accounts
CREATE TYPE account_status AS ENUM ('Dormant', 'Active', 'Suspended');
CREATE TABLE schools (
    school_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id),
    school_name VARCHAR(255) NOT NULL,
    admin_phone VARCHAR(255) NOT NULL,
    location_district VARCHAR(255) NOT NULL,
    student_count_range VARCHAR(50),
    school_type VARCHAR(100), -- e.g., 'Nursery', 'Primary', 'Secondary', 'International'
    account_status account_status DEFAULT 'Dormant',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students Table: Stores student data, isolated by school
CREATE TYPE student_status AS ENUM ('Active', 'Inactive', 'Expelled', 'Alumni', 'Suspended', 'Sick');
CREATE TYPE fees_status AS ENUM ('Paid', 'Defaulter', 'Pending');
CREATE TABLE students (
    student_id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    reg_number VARCHAR(255) UNIQUE NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    year_enrolled INT NOT NULL,
    student_status student_status DEFAULT 'Active',
    fees_status fees_status DEFAULT 'Pending',
    parent_primary_name VARCHAR(255) NOT NULL,
    parent_phone_sms VARCHAR(255) NOT NULL,
    parent_name_mother VARCHAR(255),
    parent_name_father VARCHAR(255),
    residence_district VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fees Records Table: Stores fee payment information for each student
CREATE TABLE fees_records (
    fee_record_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    term INT NOT NULL,
    year INT NOT NULL,
    total_fees_due NUMERIC(10, 2) NOT NULL,
    amount_paid NUMERIC(10, 2) DEFAULT 0.00,
    balance_due NUMERIC(10, 2) GENERATED ALWAYS AS (total_fees_due - amount_paid) STORED,
    due_date DATE NOT NULL,
    rsvp_number VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for foreign keys and frequently queried columns
CREATE INDEX ON schools (user_id);
CREATE INDEX ON students (school_id);
CREATE INDEX ON students (reg_number);
CREATE INDEX ON students (student_name);
CREATE INDEX ON fees_records (student_id);