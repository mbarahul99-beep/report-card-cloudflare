// functions/api/schools/[id].js
// GET    /api/schools/:id — get a school by id
// PUT    /api/schools/:id — update a school
// DELETE /api/schools/:id — delete a school

export async function onRequestGet(context) {
  const { env, params } = context;

  const school = await env.DB.prepare("SELECT * FROM schools WHERE school_id = ?")
    .bind(params.id)
    .first();

  if (!school) return Response.json({ error: "School not found" }, { status: 404 });
  return Response.json(school);
}

export async function onRequestPut(context) {
  const { env, params, request } = context;
  const body = await request.json();

  await env.DB.prepare(
    `UPDATE schools SET
       name = ?,
       subdomain = ?,
       branding_json = ?,
       layouts_json = ?,
       grade_scales_json = ?,
       report_structures_json = ?,
       class_naming_style = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE school_id = ?`
  )
    .bind(
      body.name,
      body.subdomain || null,
      JSON.stringify(body.branding_json || {}),
      JSON.stringify(body.layouts_json || {}),
      JSON.stringify(body.grade_scales_json || []),
      JSON.stringify(body.report_structures_json || []),
      body.class_naming_style || "roman",
      params.id
    )
    .run();

  // ── Update KV config cache ───────────────────────────────
  await updateConfigCache(env, params.id);

  return Response.json({ success: true });
}

export async function onRequestDelete(context) {
  const { env, params } = context;

  const result = await env.DB.prepare("DELETE FROM schools WHERE school_id = ?")
    .bind(params.id)
    .run();

  if (result.meta.changes === 0)
    return Response.json({ error: "School not found" }, { status: 404 });

  // ── Invalidate KV config cache ────────────────────────────
  if (env.CONFIG_CACHE) {
    try {
      await env.CONFIG_CACHE.delete(`school_config_${params.id}`);
    } catch (e) {
      // Non-fatal
    }
  }

  return Response.json({ success: true });
}

// ── Helper: update KV config cache after school config changes ─
async function updateConfigCache(env, schoolId) {
  if (!env.CONFIG_CACHE) return;

  try {
    const school = await env.DB.prepare(
      "SELECT * FROM schools WHERE school_id = ?"
    )
      .bind(schoolId)
      .first();

    if (!school) return;

    const config = {
      branding: safeParse(school.branding_json, {}),
      layouts: safeParse(school.layouts_json, {}),
      grade_scales: safeParse(school.grade_scales_json, []),
      report_structures: safeParse(school.report_structures_json, []),
      class_naming_style: school.class_naming_style || "roman",
    };

    await env.CONFIG_CACHE.put(
      `school_config_${schoolId}`,
      JSON.stringify(config)
    );
  } catch (e) {
    // Non-fatal — cache will be rebuilt on next read
  }
}

function safeParse(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}
