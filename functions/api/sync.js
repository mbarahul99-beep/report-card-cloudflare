// functions/api/sync.js
// POST /api/sync — bulk sync endpoint
// Receives the full school data payload and upserts into all tables in a single D1 batch.
// This is the recommended endpoint for Antigravity to use when saving the entire app state.
//
// NOTE: school_sync_data is no longer written to. Report cards are assembled
// on demand via GET /api/sync-school/:schoolId using relational queries.

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await request.json();

  const schoolId = body.school_id;
  if (!schoolId) {
    return Response.json({ error: "school_id is required" }, { status: 400 });
  }

  const statements = [];

  // 1. Upsert school (with layouts_json)
  statements.push(
    env.DB.prepare(
      `INSERT INTO schools (school_id, name, subdomain, branding_json, layouts_json, grade_scales_json, report_structures_json, class_naming_style, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(school_id) DO UPDATE SET
         name = excluded.name,
         subdomain = excluded.subdomain,
         branding_json = excluded.branding_json,
         layouts_json = excluded.layouts_json,
         grade_scales_json = excluded.grade_scales_json,
         report_structures_json = excluded.report_structures_json,
         class_naming_style = excluded.class_naming_style,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      schoolId,
      body.school?.name || "Untitled School",
      body.school?.subdomain || null,
      JSON.stringify(body.school?.branding_json || {}),
      JSON.stringify(body.school?.layouts_json || {}),
      JSON.stringify(body.school?.grade_scales_json || []),
      JSON.stringify(body.school?.report_structures_json || []),
      body.school?.class_naming_style || "roman"
    )
  );

  // 2. Upsert students
  if (Array.isArray(body.students)) {
    for (const s of body.students) {
      const sid = s.student_id || crypto.randomUUID();
      statements.push(
        env.DB.prepare(
          `INSERT INTO students (student_id, school_id, roll_number, full_name, father_name, mother_name, class_name, section, dob, gender, phone_number, photo_url, extra_details_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
             updated_at = CURRENT_TIMESTAMP`
        ).bind(
          sid,
          schoolId,
          s.roll_number || null,
          s.full_name,
          s.father_name || null,
          s.mother_name || null,
          s.class_name || null,
          s.section || null,
          s.dob || null,
          s.gender || null,
          s.phone_number || null,
          s.photo_url || null,
          JSON.stringify(s.extra_details_json || {})
        )
      );
    }
  }

  // 3. Upsert grades
  if (Array.isArray(body.grades)) {
    for (const g of body.grades) {
      const gid = g.id || crypto.randomUUID();
      statements.push(
        env.DB.prepare(
          `INSERT INTO student_grades (id, school_id, student_id, class_name, academic_year, term_name, marks_data_json, teacher_remarks, ai_remarks, attendance_present, attendance_total, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET
             class_name = excluded.class_name,
             academic_year = excluded.academic_year,
             term_name = excluded.term_name,
             marks_data_json = excluded.marks_data_json,
             teacher_remarks = excluded.teacher_remarks,
             ai_remarks = excluded.ai_remarks,
             attendance_present = excluded.attendance_present,
             attendance_total = excluded.attendance_total,
             updated_at = CURRENT_TIMESTAMP`
        ).bind(
          gid,
          schoolId,
          g.student_id,
          g.class_name,
          g.academic_year,
          g.term_name,
          JSON.stringify(g.marks_data_json || {}),
          g.teacher_remarks || null,
          g.ai_remarks || null,
          g.attendance_present || 0,
          g.attendance_total || 0
        )
      );
    }
  }

  // 4. Upsert users
  if (Array.isArray(body.users)) {
    for (const u of body.users) {
      const uid = u.user_id || crypto.randomUUID();
      statements.push(
        env.DB.prepare(
          `INSERT INTO users (user_id, school_id, email, role, full_name)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             school_id = excluded.school_id,
             email = excluded.email,
             role = excluded.role,
             full_name = excluded.full_name`
        ).bind(
          uid,
          u.school_id || schoolId,
          u.email,
          u.role || "teacher",
          u.full_name || null
        )
      );
    }
  }

  // Execute all statements in a single batch (atomic)
  await env.DB.batch(statements);

  // ── Update KV config cache after sync ──────────────────────
  if (env.CONFIG_CACHE) {
    try {
      const config = {
        branding: body.school?.branding_json || {},
        layouts: body.school?.layouts_json || {},
        grade_scales: body.school?.grade_scales_json || [],
        report_structures: body.school?.report_structures_json || [],
        class_naming_style: body.school?.class_naming_style || "roman",
      };
      await env.CONFIG_CACHE.put(
        `school_config_${schoolId}`,
        JSON.stringify(config)
      );
    } catch (e) {
      // Non-fatal — cache will be rebuilt on next read
    }
  }

  return Response.json({
    success: true,
    school_id: schoolId,
    synced: {
      students: body.students?.length || 0,
      grades: body.grades?.length || 0,
      users: body.users?.length || 0,
    },
    timestamp: new Date().toISOString(),
  });
}
