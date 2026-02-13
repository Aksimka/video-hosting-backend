import { Injectable } from '@nestjs/common';
import {
  type IFileStorage,
  SaveFileResult,
} from '../interfaces/file-storage.interface';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import {
  ensureDirectory,
  createDirectory,
  fileExists as checkFileExists,
} from 'src/common/utils/file-system.util';
import {
  joinPaths,
  getFileExtension,
  getRelativePath,
  normalizeWebPath,
  resolvePath,
} from 'src/common/utils/path.util';

@Injectable()
export class LocalFileStorageService implements IFileStorage {
  private readonly uploadsDir: string;

  constructor() {
    // Можно вынести в конфигурацию через ConfigModule
    this.uploadsDir = resolvePath(process.cwd(), 'uploads');
    void this.ensureUploadsDirectory();
  }

  /** Гарантирует существование корневой папки для локальных загрузок. */
  private async ensureUploadsDirectory(): Promise<void> {
    await ensureDirectory(this.uploadsDir);
  }

  /** Сохраняет бинарный файл в локальную файловую систему. */
  async saveFile(
    file: Express.Multer.File,
    destination?: string,
    videoId?: number,
  ): Promise<SaveFileResult> {
    // Проверяем структуру файла и извлекаем свойства безопасно
    const fileObj = file as unknown as {
      originalname: string;
      buffer: Buffer;
      size: number;
      mimetype: string;
    };

    if (
      !fileObj ||
      !fileObj.originalname ||
      !fileObj.buffer ||
      typeof fileObj.size !== 'number' ||
      !fileObj.mimetype
    ) {
      throw new Error('Invalid file object');
    }

    // Формируем путь: uploads/{destination}/{videoId}/source/
    let destinationDir: string;
    if (videoId && destination) {
      destinationDir = joinPaths(
        this.uploadsDir,
        destination,
        String(videoId),
        'source',
      );
    } else if (destination) {
      destinationDir = joinPaths(this.uploadsDir, destination);
    } else {
      destinationDir = this.uploadsDir;
    }

    // Создаём директорию, если её нет
    await createDirectory(destinationDir);

    // Генерируем уникальное имя файла
    const fileExtension = getFileExtension(fileObj.originalname);
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    const filePath = joinPaths(destinationDir, uniqueFilename);

    // Сохраняем файл
    await fs.writeFile(filePath, fileObj.buffer);

    return {
      filename: uniqueFilename,
      path: filePath,
      size: fileObj.size,
      mimeType: fileObj.mimetype,
    };
  }

  /** Удаляет локальный файл, игнорируя отсутствие файла. */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Файл может не существовать, это нормально
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /** Возвращает web-путь к локальному файлу относительно uploads. */
  getFileUrl(filePath: string): Promise<string> {
    // Для локального хранилища возвращаем относительный путь
    // В production можно настроить статический сервер или CDN
    const relativePath = getRelativePath(this.uploadsDir, filePath);
    return Promise.resolve(`/uploads/${normalizeWebPath(relativePath)}`);
  }

  /** Проверяет существование локального файла на диске. */
  async fileExists(filePath: string): Promise<boolean> {
    return checkFileExists(filePath);
  }
}
