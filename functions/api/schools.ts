// GET /api/schools — List all schools
export async function onRequestGet(context: any) {
  const { env } = context;
  try {
    const rows = await env.DB.prepare(
      "SELECT school_id, name, subdomain, branding_json, grade_scales_json, report_structures_json, class_naming_style, updated_at FROM schools ORDER BY updated_at DESC"
    ).all();

    const syncRows = await env.DB.prepare(
      "SELECT school_id, payload_json, updated_at FROM school_sync_data"
    ).all();

    const syncMap = new Map<string, any>();
    (syncRows.results || []).forEach((r: any) => {
      try {
        syncMap.set(r.school_id, JSON.parse(r.payload_json));
      } catch {}
    });

    const schools = (rows.results || []).map((r: any) => {
      let branding: any = {};
      try { branding = JSON.parse(r.branding_json || '{}'); } catch {}

      const syncPayload = syncMap.get(r.school_id) || {};
      const saasMeta = syncPayload.saasMeta || {};

      return {
        id: r.school_id,
        name: r.name || branding.schoolName || r.school_id,
        username: saasMeta.username || r.school_id,
        password: saasMeta.password || '',
        contactPerson: saasMeta.contactPerson || branding.contactPerson || 'School Admin',
        address: saasMeta.address || branding.address || '',
        mobile: saasMeta.mobile || branding.helpline || '',
        email: saasMeta.email || branding.email || '',
        board: saasMeta.board || 'CBSE',
        approvalStatus: saasMeta.approvalStatus || 'approved',
        portalCode: saasMeta.portalCode || syncPayload.portalCode || '',
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

// POST /api/schools — Create or update a school
export async function onRequestPost(context: any) {
  const { env, request } = context;
  try {
    const body: any = await request.json();
    const school = body.school || body;
    const cleanId = (school.id || `sc_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const now = new Date().toISOString();

    const name = school.name || cleanId;
    const brandingJson = JSON.stringify(school.branding || { schoolName: name });
    const gradeScalesJson = JSON.stringify(school.gradeScales || []);
    const reportStructuresJson = JSON.stringify(school.reportCardStructures || []);
    const classNamingStyle = school.classNamingStyle || 'roman';

    const stmt = env.DB.prepare(`
      INSERT INTO schools (school_id, name, subdomain, branding_json, grade_scales_json, report_structures_json, class_naming_style, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(school_id) DO UPDATE SET
        name = excluded.name,
        branding_json = excluded.branding_json,
        grade_scales_json = excluded.grade_scales_json,
        report_structures_json = excluded.report_structures_json,
        class_naming_style = excluded.class_naming_style,
        updated_at = excluded.updated_at
    `).bind(cleanId, name, school.subdomain || cleanId, brandingJson, gradeScalesJson, reportStructuresJson, classNamingStyle, now);

    await stmt.run();

    let payload: any = {};
    try {
      const existing = await env.DB.prepare("SELECT payload_json FROM school_sync_data WHERE school_id = ?").bind(cleanId).first();
      if (existing && existing.payload_json) {
        payload = JSON.parse(existing.payload_json as string);
      }
    } catch {}

    payload.saasMeta = { ...(payload.saasMeta || {}), ...school };
    payload.schoolName = name;
    payload.portalCode = school.portalCode || payload.portalCode || '';

    await env.DB.prepare(`
      INSERT INTO school_sync_data (school_id, payload_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(school_id) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `).bind(cleanId, JSON.stringify(payload), now).run();

    return Response.json({ success: true, schoolId: cleanId });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
