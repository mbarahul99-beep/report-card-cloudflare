// functions/api/schools/index.js
// GET  /api/schools       — list all schools
// POST /api/schools       — create a new school

export async function onRequestGet(context) {
  const { env } = context;

  const result = await env.DB.prepare(
    "SELECT * FROM schools ORDER BY created_at DESC"
  ).all();

  return Response.json(result.results);
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await request.json();

  const schoolId = body.school_id || crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO schools (school_id, name, subdomain, branding_json, layouts_json, grade_scales_json, report_structures_json, class_naming_style)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      schoolId,
      body.name,
      body.subdomain || null,
      JSON.stringify(body.branding_json || {}),
      JSON.stringify(body.layouts_json || {}),
      JSON.stringify(body.grade_scales_json || []),
      JSON.stringify(body.report_structures_json || []),
      body.class_naming_style || "roman"
    )
    .run();

  // ── Populate KV config cache on create ──────────────────
  if (env.CONFIG_CACHE) {
    try {
      const config = {
        branding: body.branding_json || {},
        layouts: body.layouts_json || {},
        grade_scales: body.grade_scales_json || [],
        report_structures: body.report_structures_json || [],
        class_naming_style: body.class_naming_style || "roman",
      };
      await env.CONFIG_CACHE.put(
        `school_config_${schoolId}`,
        JSON.stringify(config)
      );
    } catch (e) {
      // Non-fatal
    }
  }

  return Response.json({ success: true, school_id: schoolId }, { status: 201 });
}
