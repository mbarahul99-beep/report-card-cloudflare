// functions/api/students/[id].js
// GET    /api/students/:id — get a student by id
// PUT    /api/students/:id — update a student
// DELETE /api/students/:id — delete a student

export async function onRequestGet(context) {
  const { env, params } = context;

  const student = await env.DB.prepare("SELECT * FROM students WHERE student_id = ?")
    .bind(params.id)
    .first();

  if (!student) return Response.json({ error: "Student not found" }, { status: 404 });
  return Response.json(student);
}

export async function onRequestPut(context) {
  const { env, params, request } = context;
  const body = await request.json();

  await env.DB.prepare(
    `UPDATE students SET
       roll_number = ?,
       full_name = ?,
       father_name = ?,
       mother_name = ?,
       class_name = ?,
       section = ?,
       dob = ?,
       gender = ?,
       phone_number = ?,
       photo_url = ?,
       extra_details_json = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE student_id = ?`
  )
    .bind(
      body.roll_number || null,
      body.full_name,
      body.father_name || null,
      body.mother_name || null,
      body.class_name || null,
      body.section || null,
      body.dob || null,
      body.gender || null,
      body.phone_number || null,
      body.photo_url || null,
      JSON.stringify(body.extra_details_json || {}),
      params.id
    )
    .run();

  return Response.json({ success: true });
}

export async function onRequestDelete(context) {
  const { env, params } = context;

  const result = await env.DB.prepare("DELETE FROM students WHERE student_id = ?")
    .bind(params.id)
    .run();

  if (result.meta.changes === 0)
    return Response.json({ error: "Student not found" }, { status: 404 });

  return Response.json({ success: true });
}
