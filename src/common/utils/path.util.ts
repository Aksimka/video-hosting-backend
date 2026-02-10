import * as path from 'path';

/**
 * Получает директорию из пути к файлу
 */
export function getDirectory(filePath: string): string {
  return path.dirname(filePath);
}

/**
 * Получает имя файла из пути
 */
export function getFileName(filePath: string): string {
  return path.basename(filePath);
}

/**
 * Получает расширение файла
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath);
}

/**
 * Объединяет пути
 */
export function joinPaths(...paths: string[]): string {
  return path.join(...paths);
}

/**
 * Получает относительный путь от базовой директории
 */
export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to);
}

/**
 * Получает абсолютный путь относительно текущей рабочей директории
 */
export function resolvePath(...paths: string[]): string {
  return path.resolve(...paths);
}

/**
 * Нормализует путь (заменяет обратные слеши на прямые для веб-путей)
 */
export function normalizeWebPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}
