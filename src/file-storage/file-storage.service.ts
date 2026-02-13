import { Injectable, Inject } from '@nestjs/common';
import {
  type IFileStorage,
  SaveFileResult,
} from './interfaces/file-storage.interface';

@Injectable()
export class FileStorageService {
  constructor(@Inject('IFileStorage') private readonly storage: IFileStorage) {}

  /** Сохраняет файл через активную реализацию storage-провайдера. */
  async saveFile(
    file: Express.Multer.File,
    destination?: string,
    videoId?: number,
  ): Promise<SaveFileResult> {
    return this.storage.saveFile(file, destination, videoId);
  }

  /** Удаляет файл по абсолютному пути в storage-провайдере. */
  async deleteFile(filePath: string): Promise<void> {
    return this.storage.deleteFile(filePath);
  }

  /** Строит публичный URL для ранее сохраненного файла. */
  async getFileUrl(filePath: string): Promise<string> {
    return this.storage.getFileUrl(filePath);
  }

  /** Проверяет существование файла в storage-провайдере. */
  async fileExists(filePath: string): Promise<boolean> {
    return this.storage.fileExists(filePath);
  }
}
