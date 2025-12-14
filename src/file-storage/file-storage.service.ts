import { Injectable, Inject } from '@nestjs/common';
import {
  type IFileStorage,
  SaveFileResult,
} from './interfaces/file-storage.interface';

@Injectable()
export class FileStorageService {
  constructor(@Inject('IFileStorage') private readonly storage: IFileStorage) {}

  async saveFile(
    file: Express.Multer.File,
    destination?: string,
  ): Promise<SaveFileResult> {
    return this.storage.saveFile(file, destination);
  }

  async deleteFile(filePath: string): Promise<void> {
    return this.storage.deleteFile(filePath);
  }

  async getFileUrl(filePath: string): Promise<string> {
    return this.storage.getFileUrl(filePath);
  }

  async fileExists(filePath: string): Promise<boolean> {
    return this.storage.fileExists(filePath);
  }
}
