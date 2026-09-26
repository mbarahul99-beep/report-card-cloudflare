// GET /api/users — List all registered users from Cloudflare D1
export async function onRequestGet(context: any) {
  const { env } = context;
  try {
    const rows = await env.DB.prepare(
      "SELECT user_id, school_id, email, role, full_name, created_at FROM users ORDER BY created_at DESC"
    ).all();

    return Response.json({ success: true, users: rows.results || [] });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
