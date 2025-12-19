/**
 * Пример реализации хранилища для AWS S3
 * Для использования:
 * 1. Установите @aws-sdk/client-s3: npm install @aws-sdk/client-s3
 * 2. Раскомментируйте код
 * 3. В file-storage.module.ts замените LocalFileStorageService на S3FileStorageService
 */

/*
import { Injectable } from '@nestjs/common';
import { IFileStorage, SaveFileResult } from '../interfaces/file-storage.interface';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3FileStorageService implements IFileStorage {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || '';
  }

  async saveFile(
    file: Express.Multer.File,
    destination?: string,
    videoId?: number,
  ): Promise<SaveFileResult> {
    const fileExtension = file.originalname.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;
    
    // Формируем путь: {destination}/{videoId}/source/{filename} или {destination}/{filename}
    let key: string;
    if (videoId && destination) {
      key = `${destination}/${videoId}/source/${uniqueFilename}`;
    } else if (destination) {
      key = `${destination}/${uniqueFilename}`;
    } else {
      key = uniqueFilename;
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      filename: uniqueFilename,
      path: key,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  async deleteFile(filePath: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      }),
    );
  }

  async getFileUrl(filePath: string): Promise<string> {
    // Возвращаем публичный URL или signed URL
    return `https://${this.bucketName}.s3.amazonaws.com/${filePath}`;
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: filePath,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
*/
