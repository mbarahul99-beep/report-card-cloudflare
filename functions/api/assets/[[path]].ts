// GET /api/assets/* — Serve assets stored in Cloudflare R2 bucket report-card-assets
export async function onRequestGet(context: any) {
  const { env, params } = context;
  try {
    const bucket = env.REPORT_CARD_ASSETS || env.ASSETS || env.R2_BUCKET || env.ASSETS_BUCKET || env.R2;
    if (!bucket) {
      return new Response('R2 Bucket binding REPORT_CARD_ASSETS not configured', { status: 500 });
    }

    const pathArray = params.path;
    const key = Array.isArray(pathArray) ? pathArray.join('/') : (pathArray || '');
    if (!key) {
      return new Response('Missing asset key path', { status: 400 });
    }

    const object = await bucket.get(key);
    if (!object) {
      return new Response('Asset not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    if (!headers.get('Content-Type')) {
      if (key.endsWith('.png')) headers.set('Content-Type', 'image/png');
      else if (key.endsWith('.jpg') || key.endsWith('.jpeg')) headers.set('Content-Type', 'image/jpeg');
      else if (key.endsWith('.svg')) headers.set('Content-Type', 'image/svg+xml');
      else if (key.endsWith('.webp')) headers.set('Content-Type', 'image/webp');
      else headers.set('Content-Type', 'application/octet-stream');
    }

    return new Response(object.body, { headers });
  } catch (err: any) {
    return new Response(`Asset fetch error: ${err.message}`, { status: 500 });
  }
}
