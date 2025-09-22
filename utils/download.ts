export async function downloadImageFromSrc(src: string | Blob, suggestedName?: string) {
  try {
    if (typeof src !== 'string') {
      const blob = src;
      const extension = getExtensionFromMime(blob.type) || 'png';
      const fileName = suggestedName || `image-${Date.now()}.${extension}`;
      triggerDownload(blob, fileName);
      return;
    }

    // If src is a data URL, create a blob directly
    if (src.startsWith('data:')) {
      const response = await fetch(src);
      const blob = await response.blob();
      const extension = getExtensionFromMime(blob.type) || 'png';
      const fileName = suggestedName || `image-${Date.now()}.${extension}`;
      triggerDownload(blob, fileName);
      return;
    }

    // Otherwise, fetch the image respecting CORS if allowed
    const res = await fetch(src, { mode: 'cors' as RequestMode });
    const blob = await res.blob();
    const extension = getExtensionFromMime(blob.type) || inferExtensionFromUrl(src) || 'png';
    const fileName = suggestedName || getFileNameFromUrl(src) || `image-${Date.now()}.${extension}`;
    triggerDownload(blob, fileName);
  } catch (error) {
    // Fallback: try navigating to the URL with a temporary anchor
    const fallbackName = typeof src === 'string' ? (suggestedName || getFileNameFromUrl(src) || `image-${Date.now()}`) : (suggestedName || `image-${Date.now()}`);
    const anchor = document.createElement('a');
    if (typeof src === 'string') {
      anchor.href = src;
    } else {
      const url = URL.createObjectURL(src);
      anchor.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
    anchor.download = fallbackName;
    anchor.target = '_blank';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getFileNameFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url, window.location.href).pathname;
    const last = pathname.split('/').filter(Boolean).pop();
    if (!last) return null;
    return last.includes('.') ? last : `${last}.png`;
  } catch {
    return null;
  }
}

function inferExtensionFromUrl(url: string): string | null {
  const match = url.match(/\.([a-zA-Z0-9]{2,5})(?:\?|#|$)/);
  return match ? match[1] : null;
}

function getExtensionFromMime(mime: string): string | null {
  const parts = mime.split('/');
  return parts.length === 2 ? parts[1] : null;
}


