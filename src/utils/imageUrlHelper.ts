/**
 * Utility for handling, normalizing, and converting cloud image links
 * (Google Drive, Dropbox, direct web URLs) and processing uploaded watermark images.
 */

/**
 * Detects if a URL is a Google Drive file link.
 */
export function isGoogleDriveUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^&]*&)?id=)|docs\.google\.com\/(?:file\/d\/|uc\?(?:[^&]*&)?id=))/i.test(url.trim());
}

/**
 * Extracts Google Drive file ID from various Drive URL formats.
 */
export function extractGoogleDriveId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.trim().match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^&]*&)?id=)|docs\.google\.com\/(?:file\/d\/|uc\?(?:[^&]*&)?id=))([a-zA-Z0-9_-]{20,})/i);
  return match ? match[1] : null;
}

/**
 * Normalizes an image URL:
 * - If Google Drive: converts to high-performance direct CDN image URL (lh3.googleusercontent.com/d/{id})
 * - If Dropbox: converts dl=0 to raw=1 for direct binary image access
 * - Direct URLs or data URLs: returns trimmed as-is
 */
export function normalizeExternalImageUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // 1. Data URLs or blob URLs
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // 2. Google Drive links
  const driveId = extractGoogleDriveId(trimmed);
  if (driveId) {
    // lh3.googleusercontent.com/d/{id} serves direct public image binaries without HTML wrapper
    return `https://lh3.googleusercontent.com/d/${driveId}`;
  }

  // 3. Dropbox links
  if (trimmed.includes('dropbox.com')) {
    if (trimmed.includes('dl=0')) {
      return trimmed.replace('dl=0', 'raw=1');
    }
    if (!trimmed.includes('raw=1')) {
      return trimmed + (trimmed.includes('?') ? '&raw=1' : '?raw=1');
    }
  }

  return trimmed;
}

/**
 * Compresses and resizes watermark images while strictly preserving transparency (PNG/WEBP/SVG).
 * For watermarks, maintaining transparent backgrounds is critical so text/marks below remain legible.
 */
export function compressAndResizeWatermark(
  file: File, 
  callback: (base64: string) => void,
  maxWidth: number = 800,
  quality: number = 0.85
): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    const rawResult = e.target?.result as string;
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width >= height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Strictly clear canvas to ensure transparency
          ctx.clearRect(0, 0, width, height);

          const isTransparent = 
            file.type === 'image/png' || 
            file.name.toLowerCase().endsWith('.png') ||
            file.type === 'image/webp' ||
            file.type === 'image/svg+xml';

          if (!isTransparent) {
            // For JPEG without transparency, fill clean white
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
          }

          ctx.drawImage(img, 0, 0, width, height);
          const outputType = isTransparent ? 'image/png' : 'image/jpeg';
          const compressed = canvas.toDataURL(outputType, quality);
          callback(compressed);
        } else {
          callback(rawResult);
        }
      } catch (err) {
        console.warn('Canvas resizing failed, using raw file data:', err);
        callback(rawResult);
      }
    };
    img.onerror = () => callback(rawResult);
    img.src = rawResult;
  };
  reader.readAsDataURL(file);
}
