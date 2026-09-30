/**
 * Cloudflare R2 Asset Upload Helper
 * Sends image data (base64 data URL or File) to /api/upload endpoint
 * to store binary objects directly in Cloudflare R2 bucket "report-card-assets".
 */

export async function uploadImageToR2(
  fileOrBase64: File | string,
  category: string = 'assets',
  customFileName?: string
): Promise<string> {
  if (!fileOrBase64) return '';

  try {
    if (typeof fileOrBase64 === 'string') {
      if (!fileOrBase64.startsWith('data:')) {
        // Already a URL (e.g. /api/assets/... or http...), no re-upload needed
        return fileOrBase64;
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: fileOrBase64,
          category,
          fileName: customFileName || `file_${Date.now()}`
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.url) {
          return data.url;
        }
      }
    } else if (fileOrBase64 instanceof File) {
      const formData = new FormData();
      formData.append('file', fileOrBase64);
      formData.append('category', category);
      if (customFileName) formData.append('fileName', customFileName);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.url) {
          return data.url;
        }
      }
    }
  } catch (err) {
    console.warn('[uploadImageToR2] Upload request failed, fallback to local base64:', err);
  }

  // Graceful Fallback: Return original base64 or convert file to base64
  if (typeof fileOrBase64 === 'string') return fileOrBase64;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(fileOrBase64);
  });
}
