import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class InternalSyncTokenGuard implements CanActivate {
  private static readonly HEADER_NAME = 'x-internal-sync-token';

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const configuredToken = (process.env.INTERNAL_SYNC_TOKEN || '').trim();

    // TODO(security): make token mandatory in production environment.
    if (!configuredToken) {
      return true;
    }

    const receivedToken =
      request.header(InternalSyncTokenGuard.HEADER_NAME) || '';
    if (!receivedToken || receivedToken !== configuredToken) {
      throw new UnauthorizedException('Invalid internal sync token');
    }

    return true;
  }
}
