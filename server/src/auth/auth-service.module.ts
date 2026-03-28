/**
 * Auth Microservice Module
 *
 * Handles: /api/signup, /api/login, /api/logout, /api/verify-email,
 *          /api/reset-password, /api/confirm-password-reset,
 *          /api/login-with-google, /api/login-with-microsoft,
 *          /api/signup-with-google, /api/signup-with-microsoft,
 *          /api/server-info, /redirect/oauth2/*
 *          /api/health  (ALB health check)
 *
 * ALB target group: auth-service (port 3001)
 * ALB path conditions: see infrastructure/alb/listener-rules.json
 */
import { Module } from '@nestjs/common';
import { getCommonImports } from '../common-setup';
import AuthModule from './auth.module';
import UsersModule from '../users/users.module';
import DbconfigModule from '../dbconfig/dbconfig.module';
import CacherModule from '../cacher/cacher.module';
import RateLimiterModule from '../rate-limiter/rate-limiter.module';
import ServerInfoModule from '../server-info/server-info.module';
import HealthModule from '../health/health.module';
import OAuth2Module from '../oauth2/oauth2.module';

@Module({
  imports: [
    ...getCommonImports(),
    AuthModule,
    UsersModule,
    OAuth2Module,
    DbconfigModule,
    CacherModule,
    RateLimiterModule,
    ServerInfoModule,
    HealthModule,
  ],
})
export class AuthServiceModule {}
