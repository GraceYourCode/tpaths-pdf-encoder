import { Body, Controller, Get, Param, Post, Req, Res, Headers, ForbiddenException } from '@nestjs/common';
import { IsString } from 'class-validator';
import type { Response } from 'express';
import { ContentService } from './content.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/auth.decorator.js';
import { Throttle } from '../common/decorators/throttle.decorator.js';
import type { AuthRequest } from '../common/guards/auth.guard.js';

class AccessDto {
  @IsString() deviceId!: string;
}

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Throttle(30, 60000) @Post(':documentId/access') access(
    @Param('documentId') id: string,
    @Body() d: AccessDto,
    @CurrentUser() u: any,
    @Req() r: AuthRequest,
  ) {
    return this.contentService.authorize(u.id, id, d.deviceId, r.ip);
  }

  @Public() @Get(':documentId/artifact') async stream(
    @Param('documentId') id: string,
    @Req() r: AuthRequest,
    @Headers('x-content-authorization') contentToken: string,
    @Res() res: Response,
  ) {
    if (!contentToken) {
      throw new ForbiddenException('Missing X-Content-Authorization header');
    }

    const { artifactBuffer, filename } = await this.contentService.getAuthorizedArtifact(id, contentToken);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pqe"`);
    res.send(artifactBuffer);
  }
}
