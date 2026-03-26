import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import AuthService from './auth.service';
import UsersService from '../users/users.service';
import { CognitoAuthGuard } from './cognito.guard';
import OptionalJwtAuthGuard from './optional-jwt-auth.guard';
import CustomJwtModule from '../custom-jwt/custom-jwt.module';
import OAuth2Module from '../oauth2/oauth2.module';
import MailModule from '../mail/mail.module';
import RateLimiterModule from '../rate-limiter/rate-limiter.module';
import UsersModule from '../users/users.module';
import ConfigModule from '../config/config.module';
import ConfigService from '../config/config.service';


@Global()
@Module({
  imports: [
    RateLimiterModule,
    OAuth2Module,
    CustomJwtModule,
    UsersModule,
    PassportModule,
    MailModule,
    ConfigModule,
  ],
  providers: [AuthService, CognitoAuthGuard, OptionalJwtAuthGuard, ConfigService],
  exports: [AuthService, CognitoAuthGuard],
  controllers: [AuthController],
})
export default class AuthModule {}