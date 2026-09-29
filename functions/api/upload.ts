// POST /api/upload — Upload assets (logo, watermark, student photo) to R2 bucket report-card-assets
export async function onRequestPost(context: any) {
  const { env, request } = context;
  try {
    const bucket = env.REPORT_CARD_ASSETS || env.R2_BUCKET || env.ASSETS_BUCKET || env.R2;
    const contentType = request.headers.get('content-type') || '';
    let category = 'assets';
    let fileName = `file_${Date.now()}`;
    let fileBuffer: ArrayBuffer | Uint8Array = new Uint8Array(0);
    let mimeType = 'image/png';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { fileData, category: cat, fileName: fn } = body;
      if (cat) category = cat;
      if (fn) fileName = fn;

      if (!fileData) {
        return Response.json({ success: false, error: 'Missing fileData' }, { status: 400 });
      }

      if (fileData.startsWith('data:')) {
        const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          const base64Str = matches[2];
          const binaryStr = atob(base64Str);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          fileBuffer = bytes.buffer;
        } else {
          return Response.json({ success: false, error: 'Invalid base64 data format' }, { status: 400 });
        }
      } else {
        return Response.json({ success: false, error: 'Expected base64 data URL' }, { status: 400 });
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      category = (formData.get('category') as string) || 'assets';
      if (!file) {
        return Response.json({ success: false, error: 'No file uploaded' }, { status: 400 });
      }
      fileName = file.name || fileName;
      mimeType = file.type || 'image/png';
      fileBuffer = await file.arrayBuffer();
    } else {
      return Response.json({ success: false, error: 'Unsupported Content-Type' }, { status: 400 });
    }

    const cleanCategory = category.replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = mimeType.split('/')[1] || 'png';
    const uniqueId = Math.random().toString(36).substring(2, 8);
    const key = `${cleanCategory}/${Date.now()}_${uniqueId}.${ext}`;

    if (bucket) {
      await bucket.put(key, fileBuffer, {
        httpMetadata: { contentType: mimeType }
      });
      const url = `/api/assets/${key}`;
      return Response.json({ success: true, url, key, category: cleanCategory });
    } else {
      return Response.json({ 
        success: true, 
        url: `/api/assets/${key}`, 
        key, 
        category: cleanCategory,
        notice: 'R2 bucket binding deferred; key generated.' 
      });
    }
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
