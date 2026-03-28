/**
 * Users Microservice Module
 *
 * Handles: /api/me (GET, PATCH, DELETE),
 *          /api/me/meetings (GET),
 *          /api/me/link-external-calendar (POST),
 *          /api/me/confirm-link-external-calendar (GET),
 *          /api/me/oauth2-calendar-events (GET)
 *          /api/health  (ALB health check)
 *
 * ALB target group: users-service (port 3003)
 * ALB path conditions: see infrastructure/alb/listener-rules.json
 */
import { Module } from '@nestjs/common';
import { getCommonImports } from '../common-setup';
import AuthModule from '../auth/auth.module';
import UsersModule from './users.module';
import MeetingsModule from '../meetings/meetings.module';
import OAuth2Module from '../oauth2/oauth2.module';
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
    OAuth2Module,
    DbconfigModule,
    MailModule,
    CacherModule,
    RateLimiterModule,
    HealthModule,
  ],
})
export class UsersServiceModule {}
