// GET /api/schools — List all registered SaaS schools directly from schools table
export async function onRequestGet(context: any) {
  const { env } = context;
  try {
    const rows = await env.DB.prepare(`
      SELECT school_id, name, subdomain, branding_json, grade_scales_json,
             report_structures_json, layouts_json, class_naming_style, saas_meta_json, updated_at
      FROM schools ORDER BY updated_at DESC
    `).all();

    const schools = (rows.results || []).map((r: any) => {
      let branding: any = {};
      let saasMeta: any = {};
      try { if (r.branding_json) branding = JSON.parse(r.branding_json); } catch {}
      try { if (r.saas_meta_json) saasMeta = JSON.parse(r.saas_meta_json); } catch {}

      return {
        id: r.school_id,
        name: r.name || saasMeta.name || branding.schoolName || r.school_id,
        username: saasMeta.username || r.school_id,
        password: saasMeta.password || '',
        contactPerson: saasMeta.contactPerson || branding.contactPerson || 'School Admin',
        address: saasMeta.address || branding.address || '',
        mobile: saasMeta.mobile || branding.helpline || '',
        email: saasMeta.email || branding.email || '',
        board: saasMeta.board || 'CBSE',
        approvalStatus: saasMeta.approvalStatus || 'approved',
        portalCode: saasMeta.portalCode || '',
        createdAt: saasMeta.createdAt || r.updated_at || new Date().toISOString(),
        teachers: saasMeta.teachers || [],
        ...saasMeta,
      };
    });

    return Response.json({ success: true, schools });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/schools — Create or update SaaS school configuration directly in schools table and KV cache
export async function onRequestPost(context: any) {
  const { env, request } = context;
  try {
    const body: any = await request.json();
    const school = body.school || body;
    const cleanId = (school.id || `sc_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const now = new Date().toISOString();

    const name = school.name || cleanId;
    
    // Fetch existing D1 branding to avoid overwriting logos/watermarks when updating SaaS school metadata
    let existingBranding: any = null;
    try {
      const existingRow = await env.DB.prepare(`SELECT branding_json FROM schools WHERE school_id = ?`).bind(cleanId).first();
      if (existingRow && existingRow.branding_json) {
        try { existingBranding = JSON.parse(existingRow.branding_json); } catch {}
      }
    } catch {}

    const mergedBranding = {
      ...(existingBranding || {}),
      ...(school.branding || {}),
      schoolName: school.name || (school.branding?.schoolName) || (existingBranding?.schoolName) || name
    };

    const brandingJson = JSON.stringify(mergedBranding);
    const gradeScalesJson = JSON.stringify(school.gradeScales || []);
    const reportStructuresJson = JSON.stringify(school.reportCardStructures || []);
    const layoutsJson = JSON.stringify(school.layouts || school.reportCardStructures || {});
    const saasMetaJson = JSON.stringify(school);
    const classNamingStyle = school.classNamingStyle || 'roman';

    const stmt = env.DB.prepare(`
      INSERT INTO schools (
        school_id, name, subdomain, branding_json, grade_scales_json,
        report_structures_json, layouts_json, class_naming_style, saas_meta_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(school_id) DO UPDATE SET
        name = CASE WHEN excluded.name IS NOT NULL AND excluded.name != '' THEN excluded.name ELSE schools.name END,
        branding_json = CASE WHEN excluded.branding_json IS NOT NULL AND excluded.branding_json != '{}' THEN excluded.branding_json ELSE schools.branding_json END,
        grade_scales_json = CASE WHEN excluded.grade_scales_json IS NOT NULL AND excluded.grade_scales_json != '[]' THEN excluded.grade_scales_json ELSE schools.grade_scales_json END,
        report_structures_json = CASE WHEN excluded.report_structures_json IS NOT NULL AND excluded.report_structures_json != '[]' THEN excluded.report_structures_json ELSE schools.report_structures_json END,
        layouts_json = CASE WHEN excluded.layouts_json IS NOT NULL AND excluded.layouts_json != '[]' AND excluded.layouts_json != '{}' THEN excluded.layouts_json ELSE schools.layouts_json END,
        class_naming_style = excluded.class_naming_style,
        saas_meta_json = CASE WHEN excluded.saas_meta_json IS NOT NULL AND excluded.saas_meta_json != '{}' THEN excluded.saas_meta_json ELSE schools.saas_meta_json END,
        updated_at = excluded.updated_at
    `).bind(cleanId, name, school.subdomain || cleanId, brandingJson, gradeScalesJson, reportStructuresJson, layoutsJson, classNamingStyle, saasMetaJson, now);

    await stmt.run();

    // Update KV CONFIG_CACHE if namespace binding exists
    if (env.CONFIG_CACHE) {
      try {
        const configToCache = {
          branding: school.branding || { schoolName: name },
          gradeScales: school.gradeScales || [],
          reportCardStructures: school.reportCardStructures || [],
          layouts: school.layouts || school.reportCardStructures || {},
          classNamingStyle,
          saasMeta: school,
          schoolName: name,
          updatedAt: now
        };
        await env.CONFIG_CACHE.put(`school_config_${cleanId}`, JSON.stringify(configToCache), { expirationTtl: 86400 });
      } catch (kvErr: any) {
        console.warn("[CONFIG_CACHE KV Write Note]:", kvErr.message);
      }
    }

    // Upsert into D1 users table
    const userEmail = school.email || `${cleanId}@school.com`;
    const userFullName = school.contactPerson || name;
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
      console.warn("[POST /api/schools] user insert skipped or error:", uErr.message);
    }

    return Response.json({ success: true, schoolId: cleanId });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
