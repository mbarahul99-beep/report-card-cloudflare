// functions/api/student-grades/index.js
// GET  /api/student-grades?student_id=xxx&school_id=xxx  — list grades (filtered)
// POST /api/student-grades                               — create a grade record

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const studentId = url.searchParams.get("student_id");
  const schoolId = url.searchParams.get("school_id");

  let result;
  if (studentId) {
    result = await env.DB.prepare(
      "SELECT * FROM student_grades WHERE student_id = ? ORDER BY updated_at DESC"
    ).bind(studentId).all();
  } else if (schoolId) {
    result = await env.DB.prepare(
      "SELECT * FROM student_grades WHERE school_id = ? ORDER BY updated_at DESC"
    ).bind(schoolId).all();
  } else {
    result = await env.DB.prepare(
      "SELECT * FROM student_grades ORDER BY updated_at DESC"
    ).all();
  }

  return Response.json(result.results);
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await request.json();

  const id = body.id || crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO student_grades (
       id, school_id, student_id, class_name, academic_year, term_name,
       marks_data_json, teacher_remarks, ai_remarks,
       attendance_present, attendance_total
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.school_id,
      body.student_id,
      body.class_name,
      body.academic_year,
      body.term_name,
      JSON.stringify(body.marks_data_json || {}),
      body.teacher_remarks || null,
      body.ai_remarks || null,
      body.attendance_present || 0,
      body.attendance_total || 0
    )
    .run();

  return Response.json({ success: true, id: id }, { status: 201 });
}
