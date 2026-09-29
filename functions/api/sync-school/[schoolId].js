// functions/api/sync-school/[schoolId].js
// GET /api/sync-school/:schoolId — On-demand report card assembly
//
// Dynamically assembles report cards by querying relational tables
// (schools, students, student_grades) — no dependency on school_sync_data.
// Checks KV cache (school_config_${schoolId}) first for instant config reads
// (branding, layouts, grade scales). Report card data is always assembled
// fresh from D1 on every request.

export async function onRequestGet(context) {
  const { env, params } = context;
  const schoolId = params.schoolId;

  if (!schoolId) {
    return Response.json({ error: "schoolId is required" }, { status: 400 });
  }

  // ── 1. Try KV cache for school config ──────────────────────
  let config = null;
  let configServedFromCache = false;

  if (env.CONFIG_CACHE) {
    try {
      const cached = await env.CONFIG_CACHE.get(`school_config_${schoolId}`);
      if (cached) {
        config = JSON.parse(cached);
        configServedFromCache = true;
      }
    } catch (e) {
      // Cache read failed or corrupted — fall through to D1
    }
  }

  // ── 2. Query school record from D1 ─────────────────────────
  const school = await env.DB.prepare(
    "SELECT * FROM schools WHERE school_id = ?"
  )
    .bind(schoolId)
    .first();

  if (!school) {
    return Response.json({ error: "School not found" }, { status: 404 });
  }

  // ── 3. If cache miss, build config from D1 and populate KV ─
  if (!config) {
    config = {
      branding: safeParse(school.branding_json, {}),
      layouts: safeParse(school.layouts_json, {}),
      grade_scales: safeParse(school.grade_scales_json, []),
      report_structures: safeParse(school.report_structures_json, []),
      class_naming_style: school.class_naming_style || "roman",
    };

    if (env.CONFIG_CACHE) {
      try {
        await env.CONFIG_CACHE.put(
          `school_config_${schoolId}`,
          JSON.stringify(config)
        );
      } catch (e) {
        // KV write failed — non-fatal, continue without cache
      }
    }
  }

  // ── 4. Query students and grades in a single batch ────────
  const batchResult = await env.DB.batch([
    env.DB.prepare(
      "SELECT * FROM students WHERE school_id = ? ORDER BY class_name, roll_number"
    ).bind(schoolId),
    env.DB.prepare(
      "SELECT * FROM student_grades WHERE school_id = ? ORDER BY student_id, academic_year, term_name"
    ).bind(schoolId),
  ]);

  const students = batchResult[0].results;
  const grades = batchResult[1].results;

  // ── 5. Group grades by student ────────────────────────────
  const gradesByStudent = {};
  for (const g of grades) {
    const key = g.student_id;
    if (!gradesByStudent[key]) gradesByStudent[key] = [];
    gradesByStudent[key].push({
      ...g,
      marks_data: safeParse(g.marks_data_json, {}),
    });
  }

  // ── 6. Assemble report cards on demand ────────────────────
  const reportCards = students.map((s) => ({
    student: {
      ...s,
      extra_details: safeParse(s.extra_details_json, {}),
    },
    grades: gradesByStudent[s.student_id] || [],
  }));

  // ── 7. Return assembled data ───────────────────────────────
  return Response.json({
    school_id: schoolId,
    config,
    config_served_from_cache: configServedFromCache,
    school: {
      school_id: school.school_id,
      name: school.name,
      subdomain: school.subdomain,
      class_naming_style: school.class_naming_style,
    },
    students,
    grades,
    report_cards: reportCards,
    assembled_at: new Date().toISOString(),
  });
}

// ── Helper: safely parse JSON strings ───────────────────────
function safeParse(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}
