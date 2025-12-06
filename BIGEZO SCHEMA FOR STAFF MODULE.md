\-- \===================================================================  
\-- BIGEZO: STAFF MODULE SCHEMA (Detailed)  
\-- Version: 1.0  
\-- Purpose: create staff, storagedb, RBAC support, assignments, audit logs  
\-- DB: PostgreSQL  
\-- \===================================================================

BEGIN;

\-- \-----------------------------------------------------------  
\-- STEP 0: Safety checks for required referenced tables  
\-- (Assume 'schools' exists as in earlier schema).  
\-- If 'users' table exists and you want cross-references, keep as-is.  
\-- \-----------------------------------------------------------  
\-- (No destructive changes to existing tables.)

\-- \-----------------------------------------------------------  
\-- STEP 1: Create required ENUM types (if not exists)  
\-- \-----------------------------------------------------------  
DO $$  
BEGIN  
  IF NOT EXISTS (SELECT 1 FROM pg\_type WHERE typname \= 'staff\_role') THEN  
    CREATE TYPE staff\_role AS ENUM ('Teacher', 'Canteen', 'IT', 'Bursar', 'Admin');  
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg\_type WHERE typname \= 'staff\_gender') THEN  
    CREATE TYPE staff\_gender AS ENUM ('Male', 'Female', 'Other');  
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg\_type WHERE typname \= 'staff\_status') THEN  
    CREATE TYPE staff\_status AS ENUM ('Active', 'Inactive', 'Suspended', 'Deleted');  
  END IF;  
END$$ LANGUAGE plpgsql;

\-- \-----------------------------------------------------------  
\-- STEP 2: staff table (per-school staff)  
\-- \- email is globally unique to avoid login ambiguity  
\-- \- password is nullable (we prefer Google/Firebase login)  
\-- \- photourl reserved, stored when we integrate Backblaze  
\-- \- metadata and permissions stored as JSONB for flexibility  
\-- \- created\_by references users.user\_id if available; nullable  
\-- \-----------------------------------------------------------  
CREATE TABLE IF NOT EXISTS staff (  
  staff\_id            BIGSERIAL PRIMARY KEY,  
  school\_id           INT NOT NULL REFERENCES schools(school\_id) ON DELETE CASCADE,  
  first\_name          VARCHAR(255)          NOT NULL,  
  last\_name           VARCHAR(255)          NOT NULL,  
  email               VARCHAR(255)          NOT NULL,  
  phone               VARCHAR(32)           NOT NULL,  
  gender              staff\_gender          NOT NULL DEFAULT 'Male',  
  role                staff\_role            NOT NULL DEFAULT 'Teacher',  
  status              staff\_status          NOT NULL DEFAULT 'Active',  
  photourl            TEXT, \-- S3/Backblaze URL (store when integrated)  
  password\_hash       TEXT, \-- nullable: for future local auth if ever needed  
  metadata            JSONB DEFAULT '{}'::JSONB, \-- extensible profile data  
  permissions         JSONB DEFAULT '{}'::JSONB, \-- per-role/per-user overrides  
  created\_by\_user\_id  INT, \-- optional FK to users.user\_id; keep nullable for backwards compatibility  
  created\_at          TIMESTAMPTZ DEFAULT NOW(),  
  updated\_at          TIMESTAMPTZ DEFAULT NOW(),  
  CONSTRAINT staff\_email\_unique UNIQUE (email),  
  CONSTRAINT staff\_phone\_school\_unique UNIQUE (school\_id, phone)  
);

\-- Indexes for fast lookups  
CREATE INDEX IF NOT EXISTS idx\_staff\_school\_role ON staff (school\_id, role);  
CREATE INDEX IF NOT EXISTS idx\_staff\_email ON staff (email);  
CREATE INDEX IF NOT EXISTS idx\_staff\_school\_name ON staff (school\_id, last\_name, first\_name);

\-- Trigger to update updated\_at automatically  
CREATE OR REPLACE FUNCTION trg\_set\_updated\_at\_staff()  
RETURNS TRIGGER AS $$  
BEGIN  
  NEW.updated\_at := NOW();  
  RETURN NEW;  
END;  
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set\_updated\_at\_staff ON staff;  
CREATE TRIGGER set\_updated\_at\_staff  
BEFORE UPDATE ON staff  
FOR EACH ROW  
EXECUTE FUNCTION trg\_set\_updated\_at\_staff();

\-- \-----------------------------------------------------------  
\-- STEP 3: storagedb table (per-school Backblaze credentials)  
\-- \- store credentials encrypted at application level ideally; here stored as TEXT  
\-- \- include booleans for active/disabled  
\-- \- access via server-side only; never return to front-end directly  
\-- \-----------------------------------------------------------  
CREATE TABLE IF NOT EXISTS storagedb (  
  storage\_id          BIGSERIAL PRIMARY KEY,  
  school\_id           INT NOT NULL REFERENCES schools(school\_id) ON DELETE CASCADE UNIQUE,  
  provider             VARCHAR(50) NOT NULL DEFAULT 'Backblaze', \-- future-proof  
  b2\_key\_id           TEXT NOT NULL,  
  b2\_application\_key  TEXT NOT NULL,  
  bucket\_name         TEXT NOT NULL,  
  bucket\_region       TEXT,  
  max\_file\_size\_bytes INT DEFAULT 5242880, \-- default 5MB  
  is\_active           BOOLEAN DEFAULT TRUE,  
  created\_at          TIMESTAMPTZ DEFAULT NOW(),  
  updated\_at          TIMESTAMPTZ DEFAULT NOW()  
);

CREATE INDEX IF NOT EXISTS idx\_storagedb\_school ON storagedb (school\_id);

\-- Trigger to update updated\_at  
CREATE OR REPLACE FUNCTION trg\_set\_updated\_at\_storagedb()  
RETURNS TRIGGER AS $$  
BEGIN  
  NEW.updated\_at := NOW();  
  RETURN NEW;  
END;  
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set\_updated\_at\_storagedb ON storagedb;  
CREATE TRIGGER set\_updated\_at\_storagedb  
BEFORE UPDATE ON storagedb  
FOR EACH ROW  
EXECUTE FUNCTION trg\_set\_updated\_at\_storagedb();

\-- \-----------------------------------------------------------  
\-- STEP 4: teacher / staff assignment tables  
\-- We must let teachers be assigned to:  
\--  \- subjects (config\_subjects.subject\_id)  
\--  \- classes / class levels (string class\_level or existing classes table if present)  
\-- Provide both atomic assignment tables:  
\--   staff\_subject\_assignments  
\--   staff\_class\_assignments  
\-- \-----------------------------------------------------------

\-- 4.1 Staff \<-\> Subject assignment (teacher to subject)  
CREATE TABLE IF NOT EXISTS staff\_subject\_assignments (  
  assignment\_id       BIGSERIAL PRIMARY KEY,  
  staff\_id            BIGINT NOT NULL REFERENCES staff(staff\_id) ON DELETE CASCADE,  
  subject\_id          INT NOT NULL REFERENCES config\_subjects(subject\_id) ON DELETE CASCADE,  
  class\_level         VARCHAR(50) NOT NULL, \-- e.g., 'S3G', 'P7' ; mirrors config\_exams class\_level  
  term                INT,  \-- optional  
  year                INT,  \-- optional  
  assigned\_by\_user\_id INT,  \-- nullable, the admin who made assignment  
  assigned\_at         TIMESTAMPTZ DEFAULT NOW(),  
  is\_active           BOOLEAN DEFAULT TRUE,  
  CONSTRAINT uniq\_staff\_subject\_class UNIQUE (staff\_id, subject\_id, class\_level)  
);

CREATE INDEX IF NOT EXISTS idx\_staff\_subject ON staff\_subject\_assignments (staff\_id, subject\_id, class\_level);  
CREATE INDEX IF NOT EXISTS idx\_subject\_staff ON staff\_subject\_assignments (subject\_id, class\_level);

\-- 4.2 Staff \<-\> Class assignment (if the system has classes list)  
\-- If you have an existing 'classes' table you can change class\_identifier to FK  
CREATE TABLE IF NOT EXISTS staff\_class\_assignments (  
  class\_assignment\_id BIGSERIAL PRIMARY KEY,  
  staff\_id            BIGINT NOT NULL REFERENCES staff(staff\_id) ON DELETE CASCADE,  
  class\_identifier    VARCHAR(100) NOT NULL, \-- e.g., 'S3G', or you may change to class\_id FK  
  role\_in\_class       VARCHAR(100) DEFAULT 'ClassTeacher', \-- e.g., 'ClassTeacher','SubTeacher'  
  assigned\_by\_user\_id INT,  
  assigned\_at         TIMESTAMPTZ DEFAULT NOW(),  
  is\_active           BOOLEAN DEFAULT TRUE,  
  CONSTRAINT uniq\_staff\_class\_role UNIQUE (staff\_id, class\_identifier, role\_in\_class)  
);

CREATE INDEX IF NOT EXISTS idx\_staff\_class ON staff\_class\_assignments (staff\_id, class\_identifier);

\-- \-----------------------------------------------------------  
\-- STEP 5: RBAC helper tables and default permissions (optional but recommended)  
\-- \- role\_permissions: default permission set per role (extensible)  
\-- \- user\_permissions: per-user overrides (stored as JSONB in staff.permissions too)  
\-- \-----------------------------------------------------------  
CREATE TABLE IF NOT EXISTS role\_permissions (  
  role\_perm\_id        BIGSERIAL PRIMARY KEY,  
  role\_name           staff\_role NOT NULL,  
  permission\_key      VARCHAR(255) NOT NULL, \-- e.g., 'students.create', 'fees.update'  
  allowed             BOOLEAN NOT NULL DEFAULT FALSE,  
  CONSTRAINT uniq\_role\_permission UNIQUE (role\_name, permission\_key)  
);

CREATE INDEX IF NOT EXISTS idx\_role\_permissions\_role ON role\_permissions (role\_name);

\-- Optional seed will be provided later.

\-- \-----------------------------------------------------------  
\-- STEP 6: Audit log for staff actions (teacher mark entries, profile updates)  
\-- \- Store immutable log entries for compliance  
\-- \-----------------------------------------------------------  
CREATE TABLE IF NOT EXISTS staff\_audit\_log (  
  log\_id              BIGSERIAL PRIMARY KEY,  
  staff\_id            BIGINT, \-- staff who performed the action (nullable for system actions)  
  related\_staff\_id    BIGINT, \-- if the action is about a staff record  
  action\_type         VARCHAR(100) NOT NULL, \-- e.g., 'LOGIN', 'CREATE', 'UPDATE', 'ENTER\_MARK'  
  resource\_type       VARCHAR(100), \-- e.g., 'results\_entry', 'staff', 'storagedb'  
  resource\_id         BIGINT, \-- optional pointer to resource  
  school\_id           INT, \-- convenience denormalized field  
  details             JSONB DEFAULT '{}'::JSONB, \-- arbitrary structured details  
  ip\_address          VARCHAR(100),  
  user\_agent          TEXT,  
  created\_at          TIMESTAMPTZ DEFAULT NOW()  
);

CREATE INDEX IF NOT EXISTS idx\_staff\_audit\_staff ON staff\_audit\_log (staff\_id);  
CREATE INDEX IF NOT EXISTS idx\_staff\_audit\_school ON staff\_audit\_log (school\_id);  
CREATE INDEX IF NOT EXISTS idx\_staff\_audit\_action ON staff\_audit\_log (action\_type);

\-- \-----------------------------------------------------------  
\-- STEP 7: Useful views & functions  
\-- 7.1 View: active\_staff\_by\_school (quick list)  
\-- 7.2 Function: is\_staff\_email\_registered(email) \-\> BOOL  
\-- \-----------------------------------------------------------

CREATE OR REPLACE VIEW active\_staff\_by\_school AS  
SELECT staff\_id, school\_id, first\_name, last\_name, email, phone, role, status, photourl, created\_at  
FROM staff  
WHERE status \= 'Active';

\-- Function to check if an email exists in staff table  
CREATE OR REPLACE FUNCTION is\_staff\_email\_registered(in\_email VARCHAR)  
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$  
  SELECT EXISTS (SELECT 1 FROM staff WHERE email \= in\_email AND status \= 'Active');  
$$;

\-- \-----------------------------------------------------------  
\-- STEP 8: Referential & business constraints (triggers / check)  
\-- \- Ensure Teacher role has at least one assignment before marking? (Business-level check)  
\-- \- Keep constraint examples commented — implement in app logic for easier maintainability.  
\-- \-----------------------------------------------------------  
\-- Example constraint: email must be lowercase (enforced at app level or with trigger)  
CREATE OR REPLACE FUNCTION normalize\_staff\_email()  
RETURNS TRIGGER AS $$  
BEGIN  
  IF NEW.email IS NOT NULL THEN  
    NEW.email := lower(btrim(NEW.email));  
  END IF;  
  RETURN NEW;  
END;  
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg\_staff\_email\_lower ON staff;  
CREATE TRIGGER trg\_staff\_email\_lower  
BEFORE INSERT OR UPDATE ON staff  
FOR EACH ROW  
EXECUTE FUNCTION normalize\_staff\_email();

\-- \-----------------------------------------------------------  
\-- STEP 9: Example seed data (admins & roles)  
\-- NOTE: Only for testing — remove or adjust before production  
\-- \-----------------------------------------------------------  
\-- Insert default role permissions (example). App should translate permissions to allowed endpoints.  
INSERT INTO role\_permissions (role\_name, permission\_key, allowed)  
SELECT \* FROM (VALUES  
  ('Teacher'::staff\_role, 'marks.enter', TRUE),  
  ('Teacher'::staff\_role, 'marks.view', TRUE),  
  ('Teacher'::staff\_role, 'students.view', TRUE),  
  ('Bursar'::staff\_role, 'fees.view', TRUE),  
  ('Bursar'::staff\_role, 'fees.update', TRUE),  
  ('Bursar'::staff\_role, 'students.view', TRUE),  
  ('Canteen'::staff\_role, 'canteen.manage', TRUE),  
  ('IT'::staff\_role, 'integration.manage', TRUE),  
  ('Admin'::staff\_role, 'admin.\*', TRUE)  
) AS t(role, perm, allow)  
ON CONFLICT DO NOTHING;

\-- \-----------------------------------------------------------  
\-- STEP 10: Example staff seed (adjust school\_id to an existing school)  
\-- \-----------------------------------------------------------  
\-- NOTE: Replace 1 with a real school\_id in your DB if you want to insert test staff  
\-- INSERT INTO staff (school\_id, first\_name, last\_name, email, phone, role, metadata, created\_by\_user\_id)  
\-- VALUES (1, 'Test', 'Teacher', 'teacher1@example.com', '+256700000001', 'Teacher', '{"note":"seed"}', NULL);

\-- \-----------------------------------------------------------  
\-- STEP 11: Permissions & JWT guidance (documentation, not SQL)  
\-- \- When issuing JWTs for staff sessions, include:  
\--     { "staff\_id": \<int\>, "school\_id": \<int\>, "role": "\<Teacher|Bursar|IT|Canteen|Admin\>", "email": "\<...\>" }  
\-- \- Middleware should validate:  
\--     1\) token signature, 2\) staff exists & status \= 'Active', 3\) staff.school\_id \== requested school scope  
\-- \- For Bursar special rule: UI/backend must hide/deny student CRUD endpoints (enforce in RBAC middleware)  
\-- \-----------------------------------------------------------

COMMIT;

