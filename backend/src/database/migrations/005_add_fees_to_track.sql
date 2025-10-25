-- 005_add_fees_to_track.sql
BEGIN;

-- Create fees_to_track table
CREATE TABLE IF NOT EXISTS fees_to_track (
    fee_id SERIAL PRIMARY KEY,
    school_id INT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    total_due NUMERIC(10,2) NOT NULL,
    term INT NOT NULL,
    year INT NOT NULL,
    class_name VARCHAR(100),
    due_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fees_to_track_school ON fees_to_track(school_id);

-- Add fee_id to fees_records if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='fees_records' AND column_name='fee_id'
    ) THEN
        ALTER TABLE fees_records ADD COLUMN fee_id INT REFERENCES fees_to_track(fee_id) ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

COMMIT;