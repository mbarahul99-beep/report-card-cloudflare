// GET /api/health — health check + D1 connectivity test
export async function onRequestGet(context) {
  try {
    const result = await context.env.DB.prepare("SELECT COUNT(*) as count FROM schools").first();
    return Response.json({
      status: "ok",
      database: "connected",
      schools_count: result.count,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { status: "error", message: err.message, database: "disconnected" },
      { status: 500 }
    );
  }
}
