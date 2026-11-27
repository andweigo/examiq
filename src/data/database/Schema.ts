/**
 * Normalized offline SQLite schema for ExamIQ.
 * Designed for 100% local persistence, fast class/subject filtering,
 * QR assignment lookup, and single-file encrypted backup/restore.
 */
export const EXAMIQ_SQLITE_SCHEMA: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS teacher_profile (
    id TEXT PRIMARY KEY NOT NULL,
    full_name TEXT NOT NULL,
    role_title TEXT NOT NULL,
    school_name TEXT NOT NULL,
    pin_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY NOT NULL,
    grade_level TEXT NOT NULL,
    section_name TEXT NOT NULL,
    school_year TEXT NOT NULL,
    advisor_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    accent TEXT NOT NULL,
    passing_percentage INTEGER NOT NULL DEFAULT 75,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY NOT NULL,
    student_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    class_id TEXT NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT
  );`,
  `CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    term_label TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    scheduled_date TEXT NOT NULL,
    item_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT
  );`,
  `CREATE TABLE IF NOT EXISTS exam_questions (
    id TEXT PRIMARY KEY NOT NULL,
    exam_id TEXT NOT NULL,
    item_number INTEGER NOT NULL,
    prompt TEXT NOT NULL,
    choice_a TEXT NOT NULL,
    choice_b TEXT NOT NULL,
    choice_c TEXT NOT NULL,
    choice_d TEXT NOT NULL,
    correct_choice TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 1,
    UNIQUE(exam_id, item_number),
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS answer_keys (
    id TEXT PRIMARY KEY NOT NULL,
    exam_id TEXT NOT NULL,
    item_number INTEGER NOT NULL,
    correct_choice TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    UNIQUE(exam_id, item_number),
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS exam_assignments (
    id TEXT PRIMARY KEY NOT NULL,
    exam_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    qr_payload TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    UNIQUE(exam_id, student_id),
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS scan_results (
    id TEXT PRIMARY KEY NOT NULL,
    assignment_id TEXT NOT NULL,
    exam_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    raw_image_uri TEXT,
    aligned_image_uri TEXT,
    responses_json TEXT NOT NULL,
    earned_points REAL NOT NULL,
    max_points REAL NOT NULL,
    percentage REAL NOT NULL,
    is_passing INTEGER NOT NULL,
    flagged_count INTEGER NOT NULL DEFAULT 0,
    scan_status TEXT NOT NULL,
    verified_by_teacher INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (assignment_id) REFERENCES exam_assignments(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS device_alerts (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    related_entity_id TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
] as const;
