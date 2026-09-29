-- Migration 0001: Add layouts_json column and drop school_sync_data
-- Run this against the D1 database (report-card-d1) after deploying the updated code.
--
-- Usage:
--   npx wrangler d1 execute report-card-d1 --remote --file=migrations/0001_add_layouts_and_drop_sync_data.sql
--   npx wrangler d1 execute report-card-d1 --local --file=migrations/0001_add_layouts_and_drop_sync_data.sql

-- 1. Add layouts_json column to schools table (for class group layout configurations)
ALTER TABLE schools ADD COLUMN layouts_json TEXT DEFAULT '[]';

-- 2. Drop school_sync_data table (no longer used — report cards are assembled on demand)
DROP TABLE IF EXISTS school_sync_data;
