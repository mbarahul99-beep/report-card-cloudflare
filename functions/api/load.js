// functions/api/load.js
// GET /api/load?school_id=xxx — load the full school data in one request
// Returns school, students, grades, and users for the given school_id.
// This is the recommended endpoint for the frontend to call on page load.

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const schoolId = url.searchParams.get("school_id");

  if (!schoolId) {
    return Response.json({ error: "school_id query parameter is required" }, { status: 400 });
  }

  // Run all queries in a single batch for efficiency
  const batchResult = await env.DB.batch([
    env.DB.prepare("SELECT * FROM schools WHERE school_id = ?").bind(schoolId),
    env.DB.prepare("SELECT * FROM students WHERE school_id = ? ORDER BY created_at DESC").bind(schoolId),
    env.DB.prepare("SELECT * FROM student_grades WHERE school_id = ? ORDER BY updated_at DESC").bind(schoolId),
    env.DB.prepare("SELECT * FROM users WHERE school_id = ? ORDER BY created_at DESC").bind(schoolId),
  ]);

  const school = batchResult[0].results[0] || null;
  if (!school) {
    return Response.json({ error: "School not found" }, { status: 404 });
  }

  return Response.json({
    school_id: schoolId,
    school,
    students: batchResult[1].results,
    grades: batchResult[2].results,
    users: batchResult[3].results,
    loaded_at: new Date().toISOString(),
  });
}
