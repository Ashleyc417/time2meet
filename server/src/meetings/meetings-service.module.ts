/**
 * Meetings Microservice Module
 *
 * Handles: /api/meetings/:id (GET, PATCH, DELETE),
 *          /api/meetings (POST),
 *          /api/meetings/:id/respondents (POST),
 *          /api/meetings/:id/respondents/:respondentId (PUT, DELETE),
 *          /api/meetings/:id/schedule (POST)
 *          /api/health  (ALB health check)
 *
 * ALB target group: meetings-service (port 3002)
 * ALB path conditions: see infrastructure/alb/listener-rules.json
 */
import { Module } from '@nestjs/common';
import { getCommonImports } from '../common-setup';
import AuthModule from '../auth/auth.module';
import MeetingsModule from './meetings.module';
import UsersModule from '../users/users.module';
import DbconfigModule from '../dbconfig/dbconfig.module';
import MailModule from '../mail/mail.module';
import CacherModule from '../cacher/cacher.module';
import RateLimiterModule from '../rate-limiter/rate-limiter.module';
import HealthModule from '../health/health.module';

@Module({
  imports: [
    ...getCommonImports(),
    AuthModule,
    UsersModule,
    MeetingsModule,
    DbconfigModule,
    MailModule,
    CacherModule,
    RateLimiterModule,
    HealthModule,
  ],
})
export class MeetingsServiceModule {}
