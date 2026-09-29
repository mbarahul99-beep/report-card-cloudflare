// functions/api/student-grades/[id].js
// GET    /api/student-grades/:id — get a grade record by id
// PUT    /api/student-grades/:id — update a grade record
// DELETE /api/student-grades/:id — delete a grade record

export async function onRequestGet(context) {
  const { env, params } = context;

  const grade = await env.DB.prepare("SELECT * FROM student_grades WHERE id = ?")
    .bind(params.id)
    .first();

  if (!grade) return Response.json({ error: "Grade record not found" }, { status: 404 });
  return Response.json(grade);
}

export async function onRequestPut(context) {
  const { env, params, request } = context;
  const body = await request.json();

  await env.DB.prepare(
    `UPDATE student_grades SET
       class_name = ?,
       academic_year = ?,
       term_name = ?,
       marks_data_json = ?,
       teacher_remarks = ?,
       ai_remarks = ?,
       attendance_present = ?,
       attendance_total = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  )
    .bind(
      body.class_name,
      body.academic_year,
      body.term_name,
      JSON.stringify(body.marks_data_json || {}),
      body.teacher_remarks || null,
      body.ai_remarks || null,
      body.attendance_present || 0,
      body.attendance_total || 0,
      params.id
    )
    .run();

  return Response.json({ success: true });
}

export async function onRequestDelete(context) {
  const { env, params } = context;

  const result = await env.DB.prepare("DELETE FROM student_grades WHERE id = ?")
    .bind(params.id)
    .run();

  if (result.meta.changes === 0)
    return Response.json({ error: "Grade record not found" }, { status: 404 });

  return Response.json({ success: true });
}
