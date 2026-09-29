// functions/api/students/index.js
// GET  /api/students?school_id=xxx  — list students (optionally filtered by school)
// POST /api/students                — create a new student

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const schoolId = url.searchParams.get("school_id");

  let result;
  if (schoolId) {
    result = await env.DB.prepare(
      "SELECT * FROM students WHERE school_id = ? ORDER BY created_at DESC"
    ).bind(schoolId).all();
  } else {
    result = await env.DB.prepare(
      "SELECT * FROM students ORDER BY created_at DESC"
    ).all();
  }

  return Response.json(result.results);
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await request.json();

  const studentId = body.student_id || crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO students (
       student_id, school_id, roll_number, full_name, father_name,
       mother_name, class_name, section, dob, gender,
       phone_number, photo_url, extra_details_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      studentId,
      body.school_id,
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
      JSON.stringify(body.extra_details_json || {})
    )
    .run();

  return Response.json({ success: true, student_id: studentId }, { status: 201 });
}
