// functions/api/users/[id].js
// GET    /api/users/:id — get a user by id
// PUT    /api/users/:id — update a user
// DELETE /api/users/:id — delete a user

export async function onRequestGet(context) {
  const { env, params } = context;

  const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?")
    .bind(params.id)
    .first();

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });
  return Response.json(user);
}

export async function onRequestPut(context) {
  const { env, params, request } = context;
  const body = await request.json();

  await env.DB.prepare(
    `UPDATE users SET
       school_id = ?,
       email = ?,
       role = ?,
       full_name = ?
     WHERE user_id = ?`
  )
    .bind(
      body.school_id || null,
      body.email,
      body.role || "teacher",
      body.full_name || null,
      params.id
    )
    .run();

  return Response.json({ success: true });
}

export async function onRequestDelete(context) {
  const { env, params } = context;

  const result = await env.DB.prepare("DELETE FROM users WHERE user_id = ?")
    .bind(params.id)
    .run();

  if (result.meta.changes === 0)
    return Response.json({ error: "User not found" }, { status: 404 });

  return Response.json({ success: true });
}
