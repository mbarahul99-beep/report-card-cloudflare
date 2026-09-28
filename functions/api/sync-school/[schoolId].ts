// GET /api/sync-school/:schoolId — Get full school payload
export async function onRequestGet(context: any) {
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
export async function onRequestPost(context: any) {
  const { env, params, request } = context;
  try {
    const cleanId = params.schoolId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const payload: any = await request.json();
    const now = new Date().toISOString();

    let existingSaasMeta = {};
    try {
      const existing = await env.DB.prepare("SELECT payload_json FROM school_sync_data WHERE school_id = ?").bind(cleanId).first();
      if (existing && existing.payload_json) {
        const parsed = JSON.parse(existing.payload_json as string);
        existingSaasMeta = parsed.saasMeta || {};
      }
    } catch {}

    const saasMeta = { ...existingSaasMeta, ...(payload.saasMeta || {}) };
    const dataWithTimestamp = {
      ...payload,
      saasMeta,
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

    // 2. Save metadata to schools table including grade scales & report structures
    const gradeScalesStr = JSON.stringify(payload.gradeScales || []);
    const structuresStr = JSON.stringify(payload.reportCardStructures || []);
    await env.DB.prepare(`
      INSERT INTO schools (school_id, name, branding_json, grade_scales_json, report_structures_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(school_id) DO UPDATE SET
        name = excluded.name,
        branding_json = excluded.branding_json,
        grade_scales_json = excluded.grade_scales_json,
        report_structures_json = excluded.report_structures_json,
        updated_at = excluded.updated_at
    `).bind(cleanId, schoolName, JSON.stringify(payload.branding || {}), gradeScalesStr, structuresStr, now).run();

    // 2b. Upsert into users table
    const userEmail = saasMeta.email || payload.branding?.email || `${cleanId}@school.com`;
    const userFullName = saasMeta.contactPerson || payload.branding?.contactPerson || schoolName;
    try {
      await env.DB.prepare(`
        INSERT INTO users (user_id, school_id, email, role, full_name, created_at)
        VALUES (?, ?, ?, 'admin', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          school_id = excluded.school_id,
          email = excluded.email,
          full_name = excluded.full_name
      `).bind(cleanId, cleanId, userEmail, userFullName).run();
    } catch (uErr: any) {
      console.warn(`[sync-school] users table insert error for ${cleanId}:`, uErr.message);
    }

    // 3. Sync students to students table
    const studentMap = new Map<string, any>();
    if (Array.isArray(payload.students)) {
      for (const s of payload.students) {
        if (!s || !s.id) continue;
        studentMap.set(s.id, s);
        
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
        delete extra.mobileNumber;
        delete extra.phone_number;
        delete extra.photoUrl;
        delete extra.photo_url;

        const phoneNo = s.mobileNumber || s.mobile || s.phone_number || s.phone || '';
        const photoUrl = s.photoUrl || s.photo_url || s.photo || '';

        await env.DB.prepare(`
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
          s.id, cleanId, s.rollNo || s.roll_number || '', s.name || s.full_name || 'Student',
          s.fatherName || s.father_name || '', s.motherName || s.mother_name || '',
          s.className || s.class_name || '', s.section || '', s.dob || '', s.gender || '',
          phoneNo, photoUrl, JSON.stringify(extra), now
        ).run();
      }
    }

    // 4. Sync grades to student_grades table
    if (Array.isArray(payload.studentGrades)) {
      for (const g of payload.studentGrades) {
        if (!g || !g.studentId) continue;
        const studentObj = studentMap.get(g.studentId) || {};
        const gradeId = g.id || `${cleanId}_${g.studentId}_${g.termName || 'term1'}`;
        const className = g.className || g.class_name || studentObj.className || '';
        const remarks = g.teacherRemarks || g.teacher_remarks || studentObj.remarks || '';
        const aiRemarks = g.aiRemarks || g.ai_remarks || '';
        
        // Extract marks data (handles g.scholastic, g.subjects, or g.marks_data_json)
        const marksDataObj = g.scholastic || g.subjects || g.marks_data_json || {};
        const marksDataStr = typeof marksDataObj === 'object' ? JSON.stringify(marksDataObj) : String(marksDataObj);

        // Parse attendance string like "99/105" or attendance object
        let attendancePresent = g.attendancePresent || g.attendance_present || 0;
        let attendanceTotal = g.attendanceTotal || g.attendance_total || 0;
        if (!attendancePresent && g.attendance) {
          const attVal = typeof g.attendance === 'object' ? (g.attendance.term1 || g.attendance.term2 || '') : String(g.attendance);
          if (typeof attVal === 'string' && attVal.includes('/')) {
            const parts = attVal.split('/');
            attendancePresent = parseInt(parts[0], 10) || 0;
            attendanceTotal = parseInt(parts[1], 10) || 0;
          }
        }

        await env.DB.prepare(`
          INSERT INTO student_grades (
            id, school_id, student_id, class_name, academic_year, term_name,
            marks_data_json, teacher_remarks, ai_remarks, attendance_present, attendance_total, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            class_name = excluded.class_name,
            marks_data_json = excluded.marks_data_json,
            teacher_remarks = excluded.teacher_remarks,
            ai_remarks = excluded.ai_remarks,
            attendance_present = excluded.attendance_present,
            attendance_total = excluded.attendance_total,
            updated_at = excluded.updated_at
        `).bind(
          gradeId, cleanId, g.studentId, className, g.academicYear || g.academic_year || '2025-2026',
          g.termName || g.term_name || 'Term 1', marksDataStr,
          remarks, aiRemarks, attendancePresent, attendanceTotal, now
        ).run();
      }
    }

    return Response.json({ success: true, schoolId: cleanId, source: 'cloudflare_d1', savedAt: now });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE /api/sync-school/:schoolId — Delete full school data
export async function onRequestDelete(context: any) {
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
