// GET /api/sync-school/:schoolId — Assemble full report card payload on-demand from structured tables
export async function onRequestGet(context: any) {
  const { env, params } = context;
  try {
    const cleanId = params.schoolId.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // 1. Check KV Cache (CONFIG_CACHE) for fast reads of school config
    let cachedConfig: any = null;
    if (env.CONFIG_CACHE) {
      try {
        const rawKV = await env.CONFIG_CACHE.get(`school_config_${cleanId}`, 'json');
        if (rawKV) cachedConfig = rawKV;
      } catch (kvErr: any) {
        console.warn(`[CONFIG_CACHE KV Read Note]:`, kvErr.message);
      }
    }

    let schoolRow: any = null;
    let schoolConfig: any = cachedConfig || {};

    if (!cachedConfig) {
      // 2. Fetch school config from schools table in Cloudflare D1
      schoolRow = await env.DB.prepare(`
        SELECT school_id, name, subdomain, branding_json, grade_scales_json,
               report_structures_json, layouts_json, score_columns_json, subjects_json,
               classes_json, class_naming_style, saas_meta_json, updated_at
        FROM schools WHERE school_id = ?
      `).bind(cleanId).first();

      if (!schoolRow) {
        return new Response(JSON.stringify({ success: false, message: `School '${cleanId}' not found` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      let branding = {};
      let gradeScales = [];
      let reportCardStructures = [];
      let layouts = {};
      let scoreColumns = [];
      let subjects = [];
      let classes = [];
      let saasMeta = {};

      try { if (schoolRow.branding_json) branding = JSON.parse(schoolRow.branding_json); } catch {}
      try { if (schoolRow.grade_scales_json) gradeScales = JSON.parse(schoolRow.grade_scales_json); } catch {}
      try { if (schoolRow.report_structures_json) reportCardStructures = JSON.parse(schoolRow.report_structures_json); } catch {}
      try { if (schoolRow.layouts_json) layouts = JSON.parse(schoolRow.layouts_json); } catch {}
      try { if (schoolRow.score_columns_json) scoreColumns = JSON.parse(schoolRow.score_columns_json); } catch {}
      try { if (schoolRow.subjects_json) subjects = JSON.parse(schoolRow.subjects_json); } catch {}
      try { if (schoolRow.classes_json) classes = JSON.parse(schoolRow.classes_json); } catch {}
      try { if (schoolRow.saas_meta_json) saasMeta = JSON.parse(schoolRow.saas_meta_json); } catch {}

      // Auto-migrate any legacy base64 images in branding to R2 on GET
      let brandingUpdated = false;
      const bObj: any = branding || {};
      if (bObj.logoUrl && typeof bObj.logoUrl === 'string' && bObj.logoUrl.startsWith('data:')) {
        bObj.logoUrl = await ensureR2AssetUrl(env, bObj.logoUrl, 'logos');
        brandingUpdated = true;
      }
      if (bObj.rightLogoUrl && typeof bObj.rightLogoUrl === 'string' && bObj.rightLogoUrl.startsWith('data:')) {
        bObj.rightLogoUrl = await ensureR2AssetUrl(env, bObj.rightLogoUrl, 'logos');
        brandingUpdated = true;
      }
      if (bObj.watermarkLogoUrl && typeof bObj.watermarkLogoUrl === 'string' && bObj.watermarkLogoUrl.startsWith('data:')) {
        bObj.watermarkLogoUrl = await ensureR2AssetUrl(env, bObj.watermarkLogoUrl, 'watermarks');
        brandingUpdated = true;
      }
      if (bObj.watermarkUrl && typeof bObj.watermarkUrl === 'string' && bObj.watermarkUrl.startsWith('data:')) {
        bObj.watermarkUrl = await ensureR2AssetUrl(env, bObj.watermarkUrl, 'watermarks');
        brandingUpdated = true;
      }
      if (bObj.nameBannerUrl && typeof bObj.nameBannerUrl === 'string' && bObj.nameBannerUrl.startsWith('data:')) {
        bObj.nameBannerUrl = await ensureR2AssetUrl(env, bObj.nameBannerUrl, 'banners');
        brandingUpdated = true;
      }

      if (brandingUpdated) {
        try {
          await env.DB.prepare(`UPDATE schools SET branding_json = ? WHERE school_id = ?`).bind(JSON.stringify(bObj), cleanId).run();
        } catch {}
      }

      schoolConfig = {
        branding: bObj,
        gradeScales,
        reportCardStructures,
        layouts: (layouts && Object.keys(layouts).length > 0) ? layouts : reportCardStructures,
        scoreColumns,
        subjects,
        classes,
        classNamingStyle: schoolRow.class_naming_style || 'roman',
        saasMeta,
        schoolName: schoolRow.name || (bObj as any).schoolName || cleanId,
        updatedAt: schoolRow.updated_at
      };

      // Populate KV cache for future fast reads
      if (env.CONFIG_CACHE) {
        try {
          await env.CONFIG_CACHE.put(`school_config_${cleanId}`, JSON.stringify(schoolConfig), { expirationTtl: 86400 });
        } catch {}
      }
    }

    // 3. Query students table for this school
    const studentRows = await env.DB.prepare(`
      SELECT student_id, school_id, roll_number, full_name, father_name, mother_name,
             class_name, section, dob, gender, phone_number, photo_url, extra_details_json
      FROM students WHERE school_id = ?
      ORDER BY roll_number ASC, full_name ASC
    `).bind(cleanId).all();

    const students = (studentRows.results || []).map((s: any) => {
      let extra = {};
      try { if (s.extra_details_json) extra = JSON.parse(s.extra_details_json); } catch {}
      return {
        id: s.student_id,
        rollNo: s.roll_number || '',
        name: s.full_name || '',
        fatherName: s.father_name || '',
        motherName: s.mother_name || '',
        className: s.class_name || '',
        section: s.section || '',
        dob: s.dob || '',
        gender: s.gender || '',
        mobileNumber: s.phone_number || '',
        photoUrl: s.photo_url || '',
        ...extra
      };
    });

    // 4. Query student_grades table for this school
    const gradeRows = await env.DB.prepare(`
      SELECT id, school_id, student_id, class_name, academic_year, term_name,
             marks_data_json, teacher_remarks, ai_remarks, attendance_present, attendance_total
      FROM student_grades WHERE school_id = ?
    `).bind(cleanId).all();

    const studentGrades = (gradeRows.results || []).map((g: any) => {
      let scholastic = {};
      try { if (g.marks_data_json) scholastic = JSON.parse(g.marks_data_json); } catch {}
      let attendance: any = {};
      if (g.attendance_present || g.attendance_total) {
        attendance = { term1: `${g.attendance_present}/${g.attendance_total}` };
      }

      return {
        id: g.id,
        studentId: g.student_id,
        className: g.class_name || '',
        academicYear: g.academic_year || '2025-2026',
        termName: g.term_name || 'Term 1',
        scholastic,
        teacherRemarks: g.teacher_remarks || '',
        aiRemarks: g.ai_remarks || '',
        attendancePresent: g.attendance_present || 0,
        attendanceTotal: g.attendance_total || 0,
        attendance
      };
    });

    // 5. Assemble full payload dynamically
    const assembledData = {
      branding: schoolConfig.branding || {},
      scoreColumns: schoolConfig.scoreColumns || [],
      subjects: schoolConfig.subjects || [],
      gradeScales: schoolConfig.gradeScales || [],
      reportCardStructures: schoolConfig.reportCardStructures || [],
      layouts: schoolConfig.layouts || schoolConfig.reportCardStructures || {},
      students,
      studentGrades,
      classes: schoolConfig.classes || [],
      classNamingStyle: schoolConfig.classNamingStyle || 'roman',
      saasMeta: schoolConfig.saasMeta || {},
      schoolName: schoolConfig.schoolName || cleanId,
      updatedAt: schoolConfig.updatedAt || new Date().toISOString()
    };

    return Response.json({ success: true, source: 'cloudflare_d1_assembled', data: assembledData });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * Helper to upload base64 images directly to R2 bucket report-card-assets
 */
async function ensureR2AssetUrl(env: any, fileData: string, category: string): Promise<string> {
  if (!fileData || typeof fileData !== 'string' || !fileData.startsWith('data:')) {
    return fileData || '';
  }
  const bucket = env.ASSETS || env.REPORT_CARD_ASSETS || env.R2_BUCKET || env.ASSETS_BUCKET || env.R2;
  if (!bucket) return fileData;

  try {
    const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return fileData;

    const mimeType = matches[1];
    const base64Str = matches[2];
    const binaryStr = atob(base64Str);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const ext = mimeType.split('/')[1] || 'png';
    const key = `${category}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    await bucket.put(key, bytes.buffer, { httpMetadata: { contentType: mimeType } });
    return `/api/assets/${key}`;
  } catch (err: any) {
    console.warn(`[ensureR2AssetUrl] Upload warning for ${category}:`, err.message);
    return fileData;
  }
}

// POST /api/sync-school/:schoolId — Save normalized structured data to schools, students, and student_grades tables
export async function onRequestPost(context: any) {
  const { env, params, request } = context;
  try {
    const cleanId = params.schoolId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const payload: any = await request.json();
    const now = new Date().toISOString();

    const schoolName = payload.schoolName || payload.branding?.schoolName || cleanId;

    // Merge with existing D1 branding to ensure saved R2 logo/watermark URLs are never accidentally wiped
    try {
      const existingRow = await env.DB.prepare(`SELECT branding_json FROM schools WHERE school_id = ?`).bind(cleanId).first();
      if (existingRow && existingRow.branding_json) {
        let existingBranding: any = {};
        try { existingBranding = JSON.parse(existingRow.branding_json); } catch {}
        if (payload.branding) {
          if (!payload.branding.logoUrl && existingBranding.logoUrl) payload.branding.logoUrl = existingBranding.logoUrl;
          if (!payload.branding.rightLogoUrl && existingBranding.rightLogoUrl) payload.branding.rightLogoUrl = existingBranding.rightLogoUrl;
          if (!payload.branding.watermarkLogoUrl && existingBranding.watermarkLogoUrl) payload.branding.watermarkLogoUrl = existingBranding.watermarkLogoUrl;
          if (!payload.branding.watermarkUrl && existingBranding.watermarkUrl) payload.branding.watermarkUrl = existingBranding.watermarkUrl;
          if (!payload.branding.nameBannerUrl && existingBranding.nameBannerUrl) payload.branding.nameBannerUrl = existingBranding.nameBannerUrl;
        }
      }
    } catch (e: any) {
      console.warn("[sync-school POST] Existing branding check note:", e.message);
    }

    // 1. Convert base64 branding images (logo, watermark, banner) to R2 URLs
    if (payload.branding) {
      if (payload.branding.logoUrl) {
        payload.branding.logoUrl = await ensureR2AssetUrl(env, payload.branding.logoUrl, 'logos');
      }
      if (payload.branding.rightLogoUrl) {
        payload.branding.rightLogoUrl = await ensureR2AssetUrl(env, payload.branding.rightLogoUrl, 'logos');
      }
      if (payload.branding.watermarkLogoUrl) {
        payload.branding.watermarkLogoUrl = await ensureR2AssetUrl(env, payload.branding.watermarkLogoUrl, 'watermarks');
      }
      if (payload.branding.watermarkUrl) {
        payload.branding.watermarkUrl = await ensureR2AssetUrl(env, payload.branding.watermarkUrl, 'watermarks');
      }
      if (payload.branding.nameBannerUrl) {
        payload.branding.nameBannerUrl = await ensureR2AssetUrl(env, payload.branding.nameBannerUrl, 'banners');
      }
    }

    if (Array.isArray(payload.reportCardStructures)) {
      for (const struct of payload.reportCardStructures) {
        if (struct && struct.branding) {
          if (struct.branding.logoUrl) {
            struct.branding.logoUrl = await ensureR2AssetUrl(env, struct.branding.logoUrl, 'logos');
          }
          if (struct.branding.rightLogoUrl) {
            struct.branding.rightLogoUrl = await ensureR2AssetUrl(env, struct.branding.rightLogoUrl, 'logos');
          }
          if (struct.branding.watermarkLogoUrl) {
            struct.branding.watermarkLogoUrl = await ensureR2AssetUrl(env, struct.branding.watermarkLogoUrl, 'watermarks');
          }
          if (struct.branding.watermarkUrl) {
            struct.branding.watermarkUrl = await ensureR2AssetUrl(env, struct.branding.watermarkUrl, 'watermarks');
          }
          if (struct.branding.nameBannerUrl) {
            struct.branding.nameBannerUrl = await ensureR2AssetUrl(env, struct.branding.nameBannerUrl, 'banners');
          }
        }
      }
    }

    const brandingJson = JSON.stringify(payload.branding || {});
    const gradeScalesJson = JSON.stringify(payload.gradeScales || []);
    const structuresJson = JSON.stringify(payload.reportCardStructures || []);
    const layoutsJson = JSON.stringify(payload.layouts || payload.reportCardStructures || {});
    const scoreColumnsJson = JSON.stringify(payload.scoreColumns || []);
    const subjectsJson = JSON.stringify(payload.subjects || []);
    const classesJson = JSON.stringify(payload.classes || []);
    const saasMetaJson = JSON.stringify(payload.saasMeta || {});
    const classNamingStyle = payload.classNamingStyle || 'roman';

    // 2. Save school metadata & branding config into schools table
    await env.DB.prepare(`
      INSERT INTO schools (
        school_id, name, subdomain, branding_json, grade_scales_json,
        report_structures_json, layouts_json, score_columns_json, subjects_json,
        classes_json, class_naming_style, saas_meta_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(school_id) DO UPDATE SET
        name = CASE WHEN excluded.name IS NOT NULL AND excluded.name != '' THEN excluded.name ELSE schools.name END,
        branding_json = CASE WHEN excluded.branding_json IS NOT NULL AND excluded.branding_json != '{}' AND excluded.branding_json != '{"schoolName":""}' THEN excluded.branding_json ELSE schools.branding_json END,
        grade_scales_json = CASE WHEN excluded.grade_scales_json IS NOT NULL AND excluded.grade_scales_json != '[]' THEN excluded.grade_scales_json ELSE schools.grade_scales_json END,
        report_structures_json = CASE WHEN excluded.report_structures_json IS NOT NULL AND excluded.report_structures_json != '[]' THEN excluded.report_structures_json ELSE schools.report_structures_json END,
        layouts_json = CASE WHEN excluded.layouts_json IS NOT NULL AND excluded.layouts_json != '[]' AND excluded.layouts_json != '{}' THEN excluded.layouts_json ELSE schools.layouts_json END,
        score_columns_json = CASE WHEN excluded.score_columns_json IS NOT NULL AND excluded.score_columns_json != '[]' THEN excluded.score_columns_json ELSE schools.score_columns_json END,
        subjects_json = CASE WHEN excluded.subjects_json IS NOT NULL AND excluded.subjects_json != '[]' THEN excluded.subjects_json ELSE schools.subjects_json END,
        classes_json = CASE WHEN excluded.classes_json IS NOT NULL AND excluded.classes_json != '[]' THEN excluded.classes_json ELSE schools.classes_json END,
        class_naming_style = excluded.class_naming_style,
        saas_meta_json = CASE WHEN excluded.saas_meta_json IS NOT NULL AND excluded.saas_meta_json != '{}' THEN excluded.saas_meta_json ELSE schools.saas_meta_json END,
        updated_at = excluded.updated_at
    `).bind(
      cleanId, schoolName, cleanId, brandingJson, gradeScalesJson,
      structuresJson, layoutsJson, scoreColumnsJson, subjectsJson,
      classesJson, classNamingStyle, saasMetaJson, now
    ).run();

    // Update KV CONFIG_CACHE for fast reads
    if (env.CONFIG_CACHE) {
      try {
        const configToCache = {
          branding: payload.branding || {},
          gradeScales: payload.gradeScales || [],
          reportCardStructures: payload.reportCardStructures || [],
          layouts: payload.layouts || payload.reportCardStructures || {},
          scoreColumns: payload.scoreColumns || [],
          subjects: payload.subjects || [],
          classes: payload.classes || [],
          classNamingStyle,
          saasMeta: payload.saasMeta || {},
          schoolName,
          updatedAt: now
        };
        await env.CONFIG_CACHE.put(`school_config_${cleanId}`, JSON.stringify(configToCache), { expirationTtl: 86400 });
      } catch (kvErr: any) {
        console.warn(`[CONFIG_CACHE KV Write Note]:`, kvErr.message);
      }
    }

    // 3. Upsert students into students table
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

        let photoUrl = s.photoUrl || s.photo_url || s.photo || '';
        if (photoUrl) {
          photoUrl = await ensureR2AssetUrl(env, photoUrl, 'photos');
        }
        const phoneNo = s.mobileNumber || s.mobile || s.phone_number || s.phone || '';

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

    // 4. Upsert grades into student_grades table
    if (Array.isArray(payload.studentGrades)) {
      for (const g of payload.studentGrades) {
        if (!g || !g.studentId) continue;
        const studentObj = studentMap.get(g.studentId) || {};
        const gradeId = g.id || `${cleanId}_${g.studentId}_${g.termName || 'term1'}`;
        const className = g.className || g.class_name || studentObj.className || '';
        const remarks = g.teacherRemarks || g.teacher_remarks || studentObj.remarks || '';
        const aiRemarks = g.aiRemarks || g.ai_remarks || '';

        const marksDataObj = g.scholastic || g.subjects || g.marks_data_json || {};
        const marksDataStr = typeof marksDataObj === 'object' ? JSON.stringify(marksDataObj) : String(marksDataObj);

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

    // 5. Upsert into users table for school admin
    const userEmail = payload.saasMeta?.email || payload.branding?.email || `${cleanId}@school.com`;
    const userFullName = payload.saasMeta?.contactPerson || payload.branding?.contactPerson || schoolName;
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
      console.warn(`[sync-school] users insert notice for ${cleanId}:`, uErr.message);
    }

    return Response.json({ success: true, schoolId: cleanId, source: 'cloudflare_d1_structured', savedAt: now });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE /api/sync-school/:schoolId — Delete school data from all structured tables
export async function onRequestDelete(context: any) {
  const { env, params } = context;
  try {
    const cleanId = params.schoolId.replace(/[^a-zA-Z0-9_-]/g, '_');
    await env.DB.prepare("DELETE FROM student_grades WHERE school_id = ?").bind(cleanId).run();
    await env.DB.prepare("DELETE FROM students WHERE school_id = ?").bind(cleanId).run();
    await env.DB.prepare("DELETE FROM schools WHERE school_id = ?").bind(cleanId).run();

    if (env.CONFIG_CACHE) {
      try {
        await env.CONFIG_CACHE.delete(`school_config_${cleanId}`);
      } catch {}
    }

    return Response.json({ success: true, schoolId: cleanId });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
