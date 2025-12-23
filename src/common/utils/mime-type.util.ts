/**
 * Определяет MIME тип на основе расширения файла или типа контента
 */
export function getMimeType(
  filePath: string,
  contentType?: string,
): string {
  // Если передан явный тип контента, используем его
  if (contentType) {
    return contentType;
  }

  const extension = filePath.toLowerCase().split('.').pop() || '';

  const mimeTypes: Record<string, string> = {
    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogv: 'video/ogg',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    ts: 'video/mp2t',
    m3u8: 'application/vnd.apple.mpegurl',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    aac: 'audio/aac',
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    // Other
    json: 'application/json',
    xml: 'application/xml',
    pdf: 'application/pdf',
  };

  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Определяет MIME тип для HLS файлов
 */
export function getHLSMimeType(filePath: string): string {
  if (filePath.endsWith('.m3u8')) {
    return 'application/vnd.apple.mpegurl';
  }
  if (filePath.endsWith('.ts')) {
    return 'video/mp2t';
  }
  return getMimeType(filePath);
}

