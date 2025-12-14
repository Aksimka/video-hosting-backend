export interface SaveFileResult {
  filename: string;
  path: string;
  size: number;
  mimeType: string;
}

export interface IFileStorage {
  saveFile(
    file: Express.Multer.File,
    destination?: string,
  ): Promise<SaveFileResult>;

  deleteFile(filePath: string): Promise<void>;

  getFileUrl(filePath: string): Promise<string>;

  fileExists(filePath: string): Promise<boolean>;
}
