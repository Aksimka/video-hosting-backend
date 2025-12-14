import { Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { LocalFileStorageService } from './implementations/local-file-storage.service';

@Module({
  providers: [
    FileStorageService,
    {
      provide: 'IFileStorage',
      useClass: LocalFileStorageService,
    },
    LocalFileStorageService,
  ],
  exports: [FileStorageService],
})
export class FileStorageModule {}
