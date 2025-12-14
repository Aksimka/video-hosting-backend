import { Injectable } from '@nestjs/common';
import {
  type IFileStorage,
  SaveFileResult,
} from '../interfaces/file-storage.interface';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LocalFileStorageService implements IFileStorage {
  private readonly uploadsDir: string;

  constructor() {
    // Можно вынести в конфигурацию через ConfigModule
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    void this.ensureUploadsDirectory();
  }

  private async ensureUploadsDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    }
  }

  async saveFile(
    file: Express.Multer.File,
    destination?: string,
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

    const destinationDir = destination
      ? path.join(this.uploadsDir, destination)
      : this.uploadsDir;

    // Создаём директорию, если её нет
    await fs.mkdir(destinationDir, { recursive: true });

    // Генерируем уникальное имя файла
    const fileExtension = path.extname(fileObj.originalname);
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(destinationDir, uniqueFilename);

    // Сохраняем файл
    await fs.writeFile(filePath, fileObj.buffer);

    return {
      filename: uniqueFilename,
      path: filePath,
      size: fileObj.size,
      mimeType: fileObj.mimetype,
    };
  }

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

  getFileUrl(filePath: string): Promise<string> {
    // Для локального хранилища возвращаем относительный путь
    // В production можно настроить статический сервер или CDN
    const relativePath = path.relative(this.uploadsDir, filePath);
    return Promise.resolve(`/uploads/${relativePath.replace(/\\/g, '/')}`);
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
