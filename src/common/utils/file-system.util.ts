import * as fs from 'fs';
import * as fsPromises from 'fs/promises';

/**
 * Проверяет существование файла синхронно
 */
export function fileExistsSync(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Получает статистику файла синхронно
 */
export function getFileStatsSync(filePath: string): fs.Stats {
  return fs.statSync(filePath);
}

/**
 * Проверяет существование файла асинхронно
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Создает директорию рекурсивно, если её нет
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fsPromises.access(dirPath);
  } catch {
    await fsPromises.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Создает директорию рекурсивно (без проверки существования)
 */
export async function createDirectory(dirPath: string): Promise<void> {
  await fsPromises.mkdir(dirPath, { recursive: true });
}

