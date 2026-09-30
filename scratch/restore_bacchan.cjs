const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sqlPath = path.join(__dirname, 'temp_sc_1790412240562.sql');
const rawContent = fs.readFileSync(sqlPath, 'utf8');

const firstQuoteIdx = rawContent.indexOf("payload_json = '");
if (firstQuoteIdx === -1) {
  console.error("Could not find payload_json = '");
  process.exit(1);
}

const startIdx = firstQuoteIdx + "payload_json = '".length;
const whereIdx = rawContent.lastIndexOf("' WHERE school_id");
const jsonStr = rawContent.substring(startIdx, whereIdx).replace(/''/g, "'");

try {
  const payload = JSON.parse(jsonStr);
  console.log("SUCCESS! Found school backup for:", payload.branding?.schoolName);
  console.log("Report Card Structures count:", payload.reportCardStructures?.length);
  console.log("Structure ID & Name:", payload.reportCardStructures?.[0]?.id, payload.reportCardStructures?.[0]?.name);

  // Helper to recursively strip base64 image data strings
  function stripBase64(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(stripBase64);
    const cleaned = {};
    for (const k in obj) {
      if (typeof obj[k] === 'string' && obj[k].startsWith('data:image/')) {
        console.log(`Stripped base64 string at key '${k}' (len: ${obj[k].length})`);
        cleaned[k] = '';
      } else if (typeof obj[k] === 'object') {
        cleaned[k] = stripBase64(obj[k]);
      } else {
        cleaned[k] = obj[k];
      }
    }
    return cleaned;
  }

  const cleanBranding = stripBase64(payload.branding || {});
  const cleanStructures = stripBase64(payload.reportCardStructures || []);

  const schoolId = 'sc_1790412240562';
  const schoolName = payload.branding?.schoolName || 'Amitabh Bacchan School';
  const brandingJson = JSON.stringify(cleanBranding);
  const gradeScalesJson = JSON.stringify(payload.gradeScales || []);
  const reportStructuresJson = JSON.stringify(cleanStructures);
  const layoutsJson = JSON.stringify(cleanStructures);
  const scoreColumnsJson = JSON.stringify(payload.scoreColumns || []);
  const subjectsJson = JSON.stringify(payload.subjects || []);
  const classesJson = JSON.stringify(payload.classes || []);
  const saasMetaJson = JSON.stringify(payload.saasMeta || {});

  console.log("Cleaned reportStructuresJson length:", reportStructuresJson.length);
  console.log("Cleaned brandingJson length:", brandingJson.length);

  function esc(str) {
    return String(str).replace(/'/g, "''");
  }

  const updateSql = `UPDATE schools SET name = '${esc(schoolName)}', branding_json = '${esc(brandingJson)}', grade_scales_json = '${esc(gradeScalesJson)}', report_structures_json = '${esc(reportStructuresJson)}', layouts_json = '${esc(layoutsJson)}', score_columns_json = '${esc(scoreColumnsJson)}', subjects_json = '${esc(subjectsJson)}', classes_json = '${esc(classesJson)}', saas_meta_json = '${esc(saasMetaJson)}', updated_at = CURRENT_TIMESTAMP WHERE school_id = '${schoolId}';`;

  const tempFile = path.join(__dirname, 'restore_bacchan_clean.sql');
  fs.writeFileSync(tempFile, updateSql, 'utf8');

  console.log(`Prepared clean SQL script of size: ${updateSql.length} bytes at ${tempFile}`);
} catch (e) {
  console.error("JSON parse error:", e.message);
}
