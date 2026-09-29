// functions/api/assets/[type]/[file].js
// GET /api/assets/:type/:file — Serve binary assets directly from R2
//
// Returns the stored image with long-lived caching headers:
//   Cache-Control: public, max-age=31536000

export async function onRequestGet(context) {
  const { env, params } = context;

  if (!env.ASSETS) {
    return Response.json(
      { error: "R2 binding 'ASSETS' is not configured" },
      { status: 500 }
    );
  }

  const r2Key = `${params.type}/${params.file}`;

  const object = await env.ASSETS.get(r2Key);

  if (!object) {
    return Response.json({ error: "Asset not found" }, { status: 404 });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType || "application/octet-stream"
  );
  headers.set("Cache-Control", "public, max-age=31536000");
  headers.set("ETag", object.httpEtag);

  return new Response(object.body, { headers });
}
