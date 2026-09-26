// GET /api/student-grades — List student grades (optionally filtered by ?school_id=... or ?student_id=...)
export async function onRequestGet(context: any) {
  const { env, request } = context;
  try {
    const url = new URL(request.url);
    const schoolId = url.searchParams.get('school_id');
    const studentId = url.searchParams.get('student_id');

    let stmt;
    if (studentId) {
      stmt = env.DB.prepare("SELECT * FROM student_grades WHERE student_id = ?").bind(studentId);
    } else if (schoolId) {
      stmt = env.DB.prepare("SELECT * FROM student_grades WHERE school_id = ?").bind(schoolId);
    } else {
      stmt = env.DB.prepare("SELECT * FROM student_grades ORDER BY updated_at DESC");
    }

    const result = await stmt.all();
    return Response.json({ success: true, studentGrades: result.results || [] });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/student-grades — Save or update student grades
export async function onRequestPost(context: any) {
  const { env, request } = context;
  try {
    const body: any = await request.json();
    const grade = body.grade || body;
    const schoolId = grade.schoolId || grade.school_id || 'sc_default';
    const studentId = grade.studentId || grade.student_id;

    if (!studentId) {
      return Response.json({ success: false, message: 'Missing studentId' }, { status: 400 });
    }

    const id = grade.id || `${schoolId}_${studentId}_${grade.termName || 'term1'}`;
    const className = grade.className || grade.class_name || '';
    const academicYear = grade.academicYear || grade.academic_year || '2025-2026';
    const termName = grade.termName || grade.term_name || 'Term 1';
    const marksData = typeof grade.subjects === 'object' ? JSON.stringify(grade.subjects) : (grade.marks_data_json || '{}');
    const teacherRemarks = grade.teacherRemarks || grade.teacher_remarks || '';
    const aiRemarks = grade.aiRemarks || grade.ai_remarks || '';
    const attendancePresent = grade.attendancePresent || grade.attendance_present || 0;
    const attendanceTotal = grade.attendanceTotal || grade.attendance_total || 0;
    const now = new Date().toISOString();

    const stmt = env.DB.prepare(`
      INSERT INTO student_grades (
        id, school_id, student_id, class_name, academic_year, term_name,
        marks_data_json, teacher_remarks, ai_remarks, attendance_present, attendance_total, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        marks_data_json = excluded.marks_data_json,
        teacher_remarks = excluded.teacher_remarks,
        ai_remarks = excluded.ai_remarks,
        attendance_present = excluded.attendance_present,
        attendance_total = excluded.attendance_total,
        updated_at = excluded.updated_at
    `).bind(
      id, schoolId, studentId, className, academicYear, termName,
      marksData, teacherRemarks, aiRemarks, attendancePresent, attendanceTotal, now
    );

    await stmt.run();
    return Response.json({ success: true, id });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
