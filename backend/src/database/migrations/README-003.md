# Migration 003: Fix Registration Number Constraint

**Date**: 2025-10-24  
**Priority**: Required for multi-school functionality  
**Status**: Ready to apply

---

## Problem

The current `students` table has a **global UNIQUE constraint** on `reg_number`:

```sql
reg_number VARCHAR(255) UNIQUE NOT NULL
```

This means **no two students across ALL schools** can have the same registration number.

### Example of the Problem:
- School A creates student with `reg_number = "S001"`
- School B tries to create student with `reg_number = "S001"`
- ❌ **ERROR**: Duplicate key value violates unique constraint

This breaks multi-school functionality since different schools should be able to use the same registration numbers independently.

---

## Solution

Change the constraint to a **composite UNIQUE constraint** on `(reg_number, school_id)`:

```sql
CONSTRAINT students_reg_number_school_unique UNIQUE (reg_number, school_id)
```

### After Migration:
- ✅ School A can have student with `reg_number = "S001"`
- ✅ School B can **also** have student with `reg_number = "S001"`
- ❌ School A **cannot** have two students with `reg_number = "S001"`
- ❌ School B **cannot** have two students with `reg_number = "S001"`

Each school maintains unique registration numbers **within their own school**, but numbers can be reused **across different schools**.

---

## How to Apply

### Option 1: Using the Helper Script (Recommended)

```bash
# From project root
cd backend
node scripts/apply-migration-003.js
```

The script will:
1. Read the migration SQL file
2. Execute it against your database
3. Verify the constraint was created correctly
4. Show you the current constraints

### Option 2: Manual SQL Execution

Connect to your PostgreSQL database and run:

```bash
psql -U your_db_user -d your_database -f backend/src/database/migrations/003_fix_reg_number_constraint.sql
```

Or copy/paste the SQL from the migration file into your database client.

### Option 3: Using psql Command Line

```bash
psql -U your_db_user -d your_database

# Then paste this SQL:
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_reg_number_key;
ALTER TABLE students ADD CONSTRAINT students_reg_number_school_unique 
    UNIQUE (reg_number, school_id);
```

---

## Verification

After applying the migration, verify it worked:

```sql
-- Check the constraint exists
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'students' AND constraint_type = 'UNIQUE';

-- Expected output should include:
-- students_reg_number_school_unique | UNIQUE
```

---

## Testing

Test the new constraint behavior:

```sql
-- Assuming school_id 1 and 2 exist

-- This should work (same reg_number, different schools)
INSERT INTO students (school_id, reg_number, student_name, class_name, year_enrolled, 
                      parent_primary_name, parent_phone_sms, residence_district)
VALUES (1, 'TEST001', 'John Doe', 'Primary 5', 2025, 'Jane Doe', '0773913902', 'Kampala');

INSERT INTO students (school_id, reg_number, student_name, class_name, year_enrolled, 
                      parent_primary_name, parent_phone_sms, residence_district)
VALUES (2, 'TEST001', 'Mary Smith', 'Primary 3', 2025, 'Alice Smith', '0773913903', 'Entebbe');

-- ✅ Both should succeed

-- This should FAIL (duplicate reg_number in same school)
INSERT INTO students (school_id, reg_number, student_name, class_name, year_enrolled, 
                      parent_primary_name, parent_phone_sms, residence_district)
VALUES (1, 'TEST001', 'Another Student', 'Primary 4', 2025, 'Parent Name', '0773913904', 'Kampala');

-- ❌ Should fail with: duplicate key value violates unique constraint "students_reg_number_school_unique"

-- Clean up test data
DELETE FROM students WHERE reg_number = 'TEST001';
```

---

## Impact on Existing Data

### If You Have Existing Students:

The migration will **succeed** if:
- ✅ No duplicate `reg_number` exists within the same school
- ✅ Duplicate `reg_number` only exists across different schools (this is fine)

The migration will **fail** if:
- ❌ Same school has students with duplicate `reg_number`

If the migration fails, you need to fix duplicate registration numbers first:

```sql
-- Find duplicate reg_numbers within same school
SELECT school_id, reg_number, COUNT(*) 
FROM students 
GROUP BY school_id, reg_number 
HAVING COUNT(*) > 1;

-- Fix duplicates by updating reg_numbers
-- Example: Add suffix to make them unique
UPDATE students 
SET reg_number = reg_number || '-2' 
WHERE student_id = (
    SELECT student_id 
    FROM students 
    WHERE school_id = X AND reg_number = 'DUP001' 
    LIMIT 1 OFFSET 1
);
```

---

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Remove the composite constraint
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_reg_number_school_unique;

-- Add back the global unique constraint (old behavior)
ALTER TABLE students ADD CONSTRAINT students_reg_number_key UNIQUE (reg_number);
```

⚠️ **Warning**: Rolling back will break multi-school functionality and may cause errors if schools already have duplicate registration numbers.

---

## Notes

1. **Performance**: PostgreSQL automatically creates an index for the UNIQUE constraint, so queries filtering by `(reg_number, school_id)` will be efficient.

2. **Application Code**: No changes needed in application code. The existing data isolation logic (filtering by `school_id`) already handles this correctly.

3. **Frontend**: No changes needed. The student creation form already sends `school_id` with each request.

4. **Future Installations**: The main `schema.sql` file has been updated with the new constraint, so new installations will have the correct constraint from the start.

---

## Related Files

- **Migration SQL**: `backend/src/database/migrations/003_fix_reg_number_constraint.sql`
- **Helper Script**: `backend/scripts/apply-migration-003.js`
- **Main Schema**: `backend/src/database/schema.sql` (updated for new installations)

---

## Questions or Issues?

If you encounter any problems applying this migration:
1. Check your PostgreSQL version (requires 9.x+)
2. Verify you have ALTER TABLE permissions
3. Check for existing duplicate `reg_number` within same school
4. Contact: admin@bigezo.com
