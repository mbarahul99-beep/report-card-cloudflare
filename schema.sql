-- Cloudflare D1 Schema for Student Report Card Generator SaaS
-- Run locally via: npx wrangler d1 execute report-card-d1 --local --file=./schema.sql
-- Run in production via: npx wrangler d1 execute report-card-d1 --remote --file=./schema.sql

-- 1. Schools Table (Stores full school metadata, branding, settings, structures as JSON)
CREATE TABLE IF NOT EXISTS schools (
    school_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    branding_json TEXT NOT NULL DEFAULT '{}',
    grade_scales_json TEXT DEFAULT '[]',
    report_structures_json TEXT DEFAULT '[]',
    class_naming_style TEXT DEFAULT 'roman',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Students Table
CREATE TABLE IF NOT EXISTS students (
    student_id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    roll_number TEXT,
    full_name TEXT NOT NULL,
    father_name TEXT,
    mother_name TEXT,
    class_name TEXT,
    section TEXT,
    dob TEXT,
    gender TEXT,
    phone_number TEXT,
    photo_url TEXT,
    extra_details_json TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE
);

-- 3. Student Marks & Grades Table
CREATE TABLE IF NOT EXISTS student_grades (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    class_name TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    term_name TEXT NOT NULL,
    marks_data_json TEXT NOT NULL DEFAULT '{}',
    teacher_remarks TEXT,
    ai_remarks TEXT,
    attendance_present INTEGER DEFAULT 0,
    attendance_total INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- 4. Full School Payload Backup Table (Fast sync fallback matching the JSON structure)
CREATE TABLE IF NOT EXISTS school_sync_data (
    school_id TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. System Users & Admin Table
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    school_id TEXT,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'teacher', -- admin, superadmin, teacher, parent
    full_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE SET NULL
);

-- 6. Indexes for ultra-fast queries
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(school_id, class_name, section);
CREATE INDEX IF NOT EXISTS idx_grades_student ON student_grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_school_year ON student_grades(school_id, academic_year);
