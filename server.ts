import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import generatePdfHandler from "./api/generate-pdf";
import generateAiRemarksHandler from "./api/generate-ai-remarks";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware for body parsing with generous limit for school rosters and branding assets
  app.use(express.json({ limit: "50mb" }));

  // Storage directory for server-backed school persistence
  const dataDir = path.join(process.cwd(), "server-data", "schools");
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {
      console.warn("Could not create server-data directory:", e);
    }
  }

  // In-memory cache for instant cross-device synchronization
  const schoolMemoryCache = new Map<string, any>();

  // Cloudflare D1 API Environment Variables
  const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  const CF_D1_DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
  const isD1Configured = Boolean(CF_ACCOUNT_ID && CF_D1_DATABASE_ID && CF_API_TOKEN);

  /**
   * Helper function to execute SQL against Cloudflare D1 HTTP REST API
   */
  async function executeD1Query(sql: string, params: any[] = []) {
    if (!isD1Configured) {
      throw new Error("Cloudflare D1 credentials not set in environment (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN)");
    }
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sql, params })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cloudflare D1 API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(`Cloudflare D1 Query Failed: ${JSON.stringify(data.errors)}`);
    }
    return data.result?.[0]?.results || [];
  }

  // API Route: Cloudflare D1 Health Check
  app.get("/api/d1/health", async (req, res) => {
    try {
      if (!isD1Configured) {
        return res.json({
          status: "local_emulator_active",
          d1Configured: false,
          message: "D1 env vars missing. Running in local fallback mode. Configure CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, and CLOUDFLARE_API_TOKEN to connect to remote D1."
        });
      }
      const results = await executeD1Query("SELECT 1 as alive");
      return res.json({
        status: "online",
        d1Configured: true,
        message: "Cloudflare D1 Database connected successfully",
        testQuery: results
      });
    } catch (err: any) {
      return res.status(500).json({
        status: "error",
        d1Configured: isD1Configured,
        error: err.message
      });
    }
  });

  // API Route: Save school state to Cloudflare D1 (and local fallback)
  app.post("/api/d1/sync-school/:schoolId", async (req, res) => {
    const rawSchoolId = req.params.schoolId;
    const cleanSchoolId = rawSchoolId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const payload = req.body;

    if (!payload) {
      return res.status(400).json({ success: false, message: "Missing payload" });
    }

    const timestamp = new Date().toISOString();
    const dataWithTimestamp = {
      ...payload,
      updatedAt: payload.updatedAt || timestamp,
      serverSavedAt: timestamp
    };

    // Update local memory cache immediately
    schoolMemoryCache.set(cleanSchoolId, dataWithTimestamp);

    // Save to Cloudflare D1 if configured
    let d1Saved = false;
    let d1Error: string | undefined;

    if (isD1Configured) {
      try {
        const payloadStr = JSON.stringify(dataWithTimestamp);
        const schoolName = payload.schoolName || payload.branding?.schoolName || cleanSchoolId;
        
        // Upsert into school_sync_data
        await executeD1Query(
          `INSERT INTO school_sync_data (school_id, payload_json, updated_at) 
           VALUES (?, ?, ?) 
           ON CONFLICT(school_id) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at`,
          [cleanSchoolId, payloadStr, timestamp]
        );

        // Also upsert basic metadata into schools table
        await executeD1Query(
          `INSERT INTO schools (school_id, name, branding_json, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(school_id) DO UPDATE SET name=excluded.name, branding_json=excluded.branding_json, updated_at=excluded.updated_at`,
          [cleanSchoolId, schoolName, JSON.stringify(payload.branding || {}), timestamp]
        );

        d1Saved = true;
      } catch (err: any) {
        console.warn(`[D1 Sync Error for ${cleanSchoolId}]:`, err.message);
        d1Error = err.message;
      }
    }

    // Always fallback/persist to disk asynchronously as well
    const targetFile = path.join(dataDir, `${cleanSchoolId}.json`);
    fs.writeFile(targetFile, JSON.stringify(dataWithTimestamp), "utf-8", (err) => {
      if (err) console.warn(`[Disk Sync] Failed to write file for ${cleanSchoolId}:`, err);
    });

    return res.json({
      success: true,
      schoolId: cleanSchoolId,
      source: d1Saved ? "cloudflare_d1" : "local_disk",
      d1Saved,
      d1Error,
      savedAt: timestamp
    });
  });

  // API Route: Get school state from Cloudflare D1 (or local fallback)
  app.get("/api/d1/sync-school/:schoolId", async (req, res) => {
    const rawSchoolId = req.params.schoolId;
    const cleanSchoolId = rawSchoolId.replace(/[^a-zA-Z0-9_-]/g, "_");

    // Try Cloudflare D1 first if configured
    if (isD1Configured) {
      try {
        const rows = await executeD1Query(
          "SELECT payload_json FROM school_sync_data WHERE school_id = ? LIMIT 1",
          [cleanSchoolId]
        );

        if (rows && rows.length > 0 && rows[0].payload_json) {
          const parsed = JSON.parse(rows[0].payload_json);
          schoolMemoryCache.set(cleanSchoolId, parsed);
          return res.json({ success: true, source: "cloudflare_d1", data: parsed });
        }
      } catch (err: any) {
        console.warn(`[D1 Fetch Error for ${cleanSchoolId}]:`, err.message);
      }
    }

    // Fallback: Check memory cache
    if (schoolMemoryCache.has(cleanSchoolId)) {
      return res.json({ success: true, source: "memory", data: schoolMemoryCache.get(cleanSchoolId) });
    }

    // Fallback: Check disk
    const targetFile = path.join(dataDir, `${cleanSchoolId}.json`);
    if (fs.existsSync(targetFile)) {
      try {
        const raw = fs.readFileSync(targetFile, "utf-8");
        const parsed = JSON.parse(raw);
        schoolMemoryCache.set(cleanSchoolId, parsed);
        return res.json({ success: true, source: "disk", data: parsed });
      } catch (readErr) {
        console.warn(`[Disk Fetch] Failed to parse file for ${cleanSchoolId}:`, readErr);
      }
    }

    return res.status(404).json({ success: false, message: "School data not found on D1 or server" });
  });

  // Default API Sync Routes
  app.post("/api/sync-school/:schoolId", (req, res) => {
    req.url = `/api/d1/sync-school/${req.params.schoolId}`;
    return app._router.handle(req, res);
  });

  app.get("/api/sync-school/:schoolId", (req, res) => {
    req.url = `/api/d1/sync-school/${req.params.schoolId}`;
    return app._router.handle(req, res);
  });

  // API Route: Generate Report Card PDF
  app.post("/api/generate-pdf", generatePdfHandler);

  // API Route: Generate AI Remarks for Students
  app.post("/api/generate-ai-remarks", generateAiRemarksHandler);

  const distPath = path.join(process.cwd(), "dist");
  const hasDist = fs.existsSync(distPath);
  const isProduction = process.env.NODE_ENV === "production" || (process.env.NODE_ENV !== "development" && hasDist);

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware mounted successfully.");
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static server assets mounted successfully.");
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`[FULL-STACK] Server listening on port ${PORT} with Cloudflare D1 integration support.`);
  });
}

startServer();
