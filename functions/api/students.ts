interface Env {
  DB: D1Database;
}

// GET /api/students — List students (optionally filtered by ?school_id=...)
export async function onRequestGet(context: EventContext<Env, any, any>) {
  const { env, request } = context;
  try {
    const url = new URL(request.url);
    const schoolId = url.searchParams.get('school_id');

    let stmt;
    if (schoolId) {
      stmt = env.DB.prepare(
        "SELECT * FROM students WHERE school_id = ? ORDER BY created_at DESC"
      ).bind(schoolId);
    } else {
      stmt = env.DB.prepare(
        "SELECT * FROM students ORDER BY created_at DESC"
      );
    }

    const result = await stmt.all();
    return Response.json({ success: true, students: result.results || [] });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/students — Create or update a student
export async function onRequestPost(context: EventContext<Env, any, any>) {
  const { env, request } = context;
  try {
    const body: any = await request.json();
    const student = body.student || body;
    const studentId = student.id || student.student_id || `std_${Date.now()}`;
    const schoolId = student.schoolId || student.school_id || 'sc_default';
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

    const extra = { ...student };
    delete extra.id;
    delete extra.student_id;
    delete extra.name;
    delete extra.full_name;
    delete extra.rollNo;
    delete extra.roll_number;
    delete extra.fatherName;
    delete extra.father_name;
    delete extra.motherName;
    delete extra.mother_name;
    delete extra.className;
    delete extra.class_name;
    delete extra.section;
    delete extra.dob;
    delete extra.gender;
    delete extra.mobile;
    delete extra.phone_number;

    const stmt = env.DB.prepare(`
      INSERT INTO students (
        student_id, school_id, roll_number, full_name, father_name, mother_name,
        class_name, section, dob, gender, phone_number, photo_url, extra_details_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id) DO UPDATE SET
        roll_number = excluded.roll_number,
        full_name = excluded.full_name,
        father_name = excluded.father_name,
        mother_name = excluded.mother_name,
        class_name = excluded.class_name,
        section = excluded.section,
        dob = excluded.dob,
        gender = excluded.gender,
        phone_number = excluded.phone_number,
        photo_url = excluded.photo_url,
        extra_details_json = excluded.extra_details_json,
        updated_at = excluded.updated_at
    `).bind(
      studentId, schoolId, rollNumber, fullName, fatherName, motherName,
      className, section, dob, gender, phoneNumber, photoUrl, JSON.stringify(extra), now
    );

    await stmt.run();
    return Response.json({ success: true, id: studentId });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
