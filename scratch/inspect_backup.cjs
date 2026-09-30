const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, 'temp_sc_1790412240562.sql');
if (!fs.existsSync(sqlPath)) {
  console.log("No backup SQL file found at:", sqlPath);
  process.exit(0);
}

const rawContent = fs.readFileSync(sqlPath, 'utf8');
const firstQuoteIdx = rawContent.indexOf("payload_json = '");
if (firstQuoteIdx === -1) {
  console.log("No payload_json found");
  process.exit(0);
}

const startIdx = firstQuoteIdx + "payload_json = '".length;
const whereIdx = rawContent.lastIndexOf("' WHERE school_id");
const jsonStr = rawContent.substring(startIdx, whereIdx).replace(/''/g, "'");

try {
  const payload = JSON.parse(jsonStr);
  console.log("Keys in payload:", Object.keys(payload));
  if (payload.reportCardStructures) {
    console.log("Structures count:", payload.reportCardStructures.length);
    for (let i = 0; i < payload.reportCardStructures.length; i++) {
      const st = payload.reportCardStructures[i];
      const strified = JSON.stringify(st);
      console.log(`Structure [${i}] id=${st.id} name=${st.name} len=${strified.length}`);
      // Find where heavy content is inside structure
      for (const k in st) {
        const subLen = JSON.stringify(st[k]).length;
        if (subLen > 1000) {
          console.log(`  -> Key ${k} length: ${subLen}`);
        }
      }
    }
  }
} catch (e) {
  console.error("Parse error:", e.message);
}
