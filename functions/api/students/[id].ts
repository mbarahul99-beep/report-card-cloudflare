interface Env {
  DB: D1Database;
}

// GET /api/students/:id — Get a specific student
export async function onRequestGet(context: EventContext<Env, 'id', any>) {
  const { env, params } = context;
  try {
    const student = await env.DB.prepare(
      "SELECT * FROM students WHERE student_id = ?"
    ).bind(params.id).first();

    if (!student) {
      return new Response(JSON.stringify({ success: false, message: 'Student not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return Response.json({ success: true, student });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT /api/students/:id — Update a specific student
export async function onRequestPut(context: EventContext<Env, 'id', any>) {
  const { env, params, request } = context;
  try {
    const body: any = await request.json();
    const student = body.student || body;
    const now = new Date().toISOString();

    const rollNumber = student.rollNo || student.roll_number || '';
    const fullName = student.name || student.full_name || 'Student';
    const fatherName = student.fatherName || student.father_name || '';
    const motherName = student.motherName || student.mother_name || '';
    const className = student.className || student.class_name || '';
    const section = student.section || '';
    const dob = student.dob || '';
    const gender = student.gender || '';
    const phoneNumber = student.mobile || student.phone_number || '';
    const photoUrl = student.photoUrl || student.photo_url || '';

    const stmt = env.DB.prepare(`
      UPDATE students SET
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
        updated_at = ?
      WHERE student_id = ?
    `).bind(
      rollNumber, fullName, fatherName, motherName, className,
      section, dob, gender, phoneNumber, photoUrl, now, params.id
    );

    await stmt.run();
    return Response.json({ success: true, id: params.id });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE /api/students/:id — Delete a specific student
export async function onRequestDelete(context: EventContext<Env, 'id', any>) {
  const { env, params } = context;
  try {
    await env.DB.prepare("DELETE FROM student_grades WHERE student_id = ?").bind(params.id).run();
    await env.DB.prepare("DELETE FROM students WHERE student_id = ?").bind(params.id).run();

    return Response.json({ success: true, id: params.id });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
