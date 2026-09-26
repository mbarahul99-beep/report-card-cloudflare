interface Env {
  DB: D1Database;
}

// GET /api/sync-school/:schoolId — Get full school payload
export async function onRequestGet(context: EventContext<Env, 'schoolId', any>) {
  const { env, params } = context;
  try {
    const cleanId = params.schoolId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const row = await env.DB.prepare(
      "SELECT payload_json FROM school_sync_data WHERE school_id = ?"
    ).bind(cleanId).first();

    if (!row || !row.payload_json) {
      return new Response(JSON.stringify({ success: false, message: 'School sync payload not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const parsed = JSON.parse(row.payload_json as string);
    return Response.json({ success: true, source: 'cloudflare_d1', data: parsed });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/sync-school/:schoolId — Save full school payload and synchronize across D1 tables
export async function onRequestPost(context: EventContext<Env, 'schoolId', any>) {
  const { env, params, request } = context;
  try {
    const cleanId = params.schoolId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const payload: any = await request.json();
    const now = new Date().toISOString();

    const dataWithTimestamp = {
      ...payload,
      updatedAt: payload.updatedAt || now,
      serverSavedAt: now,
    };

    const payloadStr = JSON.stringify(dataWithTimestamp);
    const schoolName = payload.schoolName || payload.branding?.schoolName || cleanId;

    // 1. Save to school_sync_data table
    await env.DB.prepare(`
      INSERT INTO school_sync_data (school_id, payload_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(school_id) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `).bind(cleanId, payloadStr, now).run();

    // 2. Save metadata to schools table
    await env.DB.prepare(`
      INSERT INTO schools (school_id, name, branding_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(school_id) DO UPDATE SET
        name = excluded.name,
        branding_json = excluded.branding_json,
        updated_at = excluded.updated_at
    `).bind(cleanId, schoolName, JSON.stringify(payload.branding || {}), now).run();

    // 3. Sync students to students table
    if (Array.isArray(payload.students)) {
      for (const s of payload.students) {
        if (!s || !s.id) continue;
        const extra = { ...s };
        delete extra.id;
        delete extra.name;
        delete extra.rollNo;
        delete extra.fatherName;
        delete extra.motherName;
        delete extra.className;
        delete extra.section;
        delete extra.dob;
        delete extra.gender;
        delete extra.mobile;

        await env.DB.prepare(`
          INSERT INTO students (
            student_id, school_id, roll_number, full_name, father_name, mother_name,
            class_name, section, dob, gender, phone_number, extra_details_json, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            extra_details_json = excluded.extra_details_json,
            updated_at = excluded.updated_at
        `).bind(
          s.id, cleanId, s.rollNo || s.roll_number || '', s.name || s.full_name || 'Student',
          s.fatherName || s.father_name || '', s.motherName || s.mother_name || '',
          s.className || s.class_name || '', s.section || '', s.dob || '', s.gender || '',
          s.mobile || s.phone_number || '', JSON.stringify(extra), now
        ).run();
      }
    }

    // 4. Sync grades to student_grades table
    if (Array.isArray(payload.studentGrades)) {
      for (const g of payload.studentGrades) {
        if (!g || !g.studentId) continue;
        const gradeId = g.id || `${cleanId}_${g.studentId}_${g.termName || 'term1'}`;
        const marksData = g.subjects || g.marks_data_json || {};

        await env.DB.prepare(`
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
          gradeId, cleanId, g.studentId, g.className || '', g.academicYear || '2025-2026',
          g.termName || 'Term 1', typeof marksData === 'object' ? JSON.stringify(marksData) : marksData,
          g.teacherRemarks || '', g.aiRemarks || '', g.attendancePresent || 0, g.attendanceTotal || 0, now
        ).run();
      }
    }

    return Response.json({ success: true, schoolId: cleanId, source: 'cloudflare_d1', savedAt: now });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE /api/sync-school/:schoolId — Delete full school data
export async function onRequestDelete(context: EventContext<Env, 'schoolId', any>) {
  const { env, params } = context;
  try {
    const cleanId = params.schoolId.replace(/[^a-zA-Z0-9_-]/g, '_');
    await env.DB.prepare("DELETE FROM student_grades WHERE school_id = ?").bind(cleanId).run();
    await env.DB.prepare("DELETE FROM students WHERE school_id = ?").bind(cleanId).run();
    await env.DB.prepare("DELETE FROM school_sync_data WHERE school_id = ?").bind(cleanId).run();
    await env.DB.prepare("DELETE FROM schools WHERE school_id = ?").bind(cleanId).run();

    return Response.json({ success: true, schoolId: cleanId });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
