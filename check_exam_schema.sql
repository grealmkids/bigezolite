\pset pager off
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'config_exam_sets';
