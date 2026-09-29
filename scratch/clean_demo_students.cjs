const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log("Fetching school_sync_data rows...");
  const out = execSync(`npx wrangler d1 execute report-card-d1 --remote --command "SELECT school_id, payload_json FROM school_sync_data WHERE school_id != 'sc_demo'"`, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });

  const jsonStart = out.indexOf('[');
  const jsonText = out.slice(jsonStart);
  const parsedOut = JSON.parse(jsonText);
  const rows = parsedOut[0].results || [];

  for (const r of rows) {
    const schoolId = r.school_id;
    if (!r.payload_json) continue;
    const payload = JSON.parse(r.payload_json);

    let modified = false;
    if (Array.isArray(payload.students)) {
      const origCount = payload.students.length;
      payload.students = payload.students.filter(s => !['stud_1', 'stud_2', 'stud_3'].includes(s.id));
      if (payload.students.length !== origCount) modified = true;
    }
    if (Array.isArray(payload.studentGrades)) {
      const origCount = payload.studentGrades.length;
      payload.studentGrades = payload.studentGrades.filter(g => !['stud_1', 'stud_2', 'stud_3'].includes(g.studentId));
      if (payload.studentGrades.length !== origCount) modified = true;
    }

    if (modified) {
      console.log(`Cleaning demo students from ${schoolId}...`);
      const tempSqlFile = `./scratch/temp_${schoolId}.sql`;
      const updatedJson = JSON.stringify(payload).replace(/'/g, "''");
      const sqlContent = `UPDATE school_sync_data SET payload_json = '${updatedJson}' WHERE school_id = '${schoolId}';`;
      fs.writeFileSync(tempSqlFile, sqlContent, 'utf8');

      execSync(`npx wrangler d1 execute report-card-d1 --remote --file="${tempSqlFile}"`, {
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024
      });

      fs.unlinkSync(tempSqlFile);
      console.log(`Successfully cleaned ${schoolId}!`);
    } else {
      console.log(`No demo students found in ${schoolId}. Clean!`);
    }
  }
  console.log("All non-demo school sync payloads cleaned!");
} catch (err) {
  console.error("Error cleaning demo students:", err.message);
}
