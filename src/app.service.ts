import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /** Возвращает health-check строку для корневого endpoint. */
  getHello(): string {
    return 'Hello World!';
  }
}
