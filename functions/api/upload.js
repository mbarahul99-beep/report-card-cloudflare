// functions/api/upload.js
// POST /api/upload — Upload images (logos, watermarks, student photos) to R2
//
// Accepts two formats:
//   1. multipart/form-data  — field "file" (the image), field "type" (logos|watermarks|photos)
//   2. application/json      — { "type": "logos", "data": "base64...", "mime_type": "image/png" }
//      The data field may include a data-URL prefix: data:image/png;base64,....
//
// Returns a clean URL (/api/assets/<type>/<filename>) that can be stored in D1.

export async function onRequestPost(context) {
  const { env, request } = context;

  if (!env.ASSETS) {
    return Response.json(
      { error: "R2 binding 'ASSETS' is not configured" },
      { status: 500 }
    );
  }

  const contentType = request.headers.get("Content-Type") || "";

  let fileData;     // Uint8Array
  let mimeType;     // e.g. "image/png"
  let type;         // "logos" | "watermarks" | "photos"

  if (contentType.includes("multipart/form-data")) {
    // ── Multipart upload ─────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get("file");
    type = (formData.get("type") || "photos").toString();

    if (!file) {
      return Response.json({ error: "No file provided in 'file' field" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    fileData = new Uint8Array(arrayBuffer);
    mimeType = file.type || "image/png";
  } else {
    // ── Base64 JSON upload ───────────────────────────────────
    const body = await request.json();
    type = body.type || "photos";
    const base64Data = body.data;

    if (!base64Data) {
      return Response.json({ error: "No 'data' field provided" }, { status: 400 });
    }

    // Strip data-URL prefix if present (data:image/png;base64,....)
    const dataUrlMatch = base64Data.match(/^data:([^;]+);base64,(.*)$/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      fileData = base64ToUint8Array(dataUrlMatch[2]);
    } else {
      mimeType = body.mime_type || "image/png";
      fileData = base64ToUint8Array(base64Data);
    }
  }

  // ── Validate type ───────────────────────────────────────────
  const validTypes = ["logos", "watermarks", "photos"];
  if (!validTypes.includes(type)) {
    return Response.json(
      { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  // ── Generate unique filename and R2 key ─────────────────────
  const ext = (mimeType.split("/")[1] || "png").replace("svg+xml", "svg");
  const filename = `${crypto.randomUUID()}.${ext}`;
  const r2Key = `${type}/${filename}`;

  // ── Store in R2 ─────────────────────────────────────────────
  await env.ASSETS.put(r2Key, fileData, {
    httpMetadata: {
      contentType: mimeType,
    },
  });

  // ── Return clean URL for D1 storage ────────────────────────
  const assetUrl = `/api/assets/${type}/${filename}`;

  return Response.json(
    {
      success: true,
      type,
      filename,
      url: assetUrl,
      r2_key: r2Key,
      content_type: mimeType,
    },
    { status: 201 }
  );
}

// ── Helper: decode base64 string to Uint8Array ───────────────
function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
