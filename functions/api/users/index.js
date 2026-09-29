// functions/api/users/index.js
// GET  /api/users?school_id=xxx  — list users (optionally filtered by school)
// POST /api/users                — create a new user

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const schoolId = url.searchParams.get("school_id");

  let result;
  if (schoolId) {
    result = await env.DB.prepare(
      "SELECT * FROM users WHERE school_id = ? ORDER BY created_at DESC"
    ).bind(schoolId).all();
  } else {
    result = await env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  }

  return Response.json(result.results);
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await request.json();

  const userId = body.user_id || crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO users (user_id, school_id, email, role, full_name)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(
      userId,
      body.school_id || null,
      body.email,
      body.role || "teacher",
      body.full_name || null
    )
    .run();

  return Response.json({ success: true, user_id: userId }, { status: 201 });
}
