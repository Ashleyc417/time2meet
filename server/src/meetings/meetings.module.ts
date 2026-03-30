import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import RateLimiterModule from '../rate-limiter/rate-limiter.module';
import MailModule from '../mail/mail.module';
import MeetingDeleterService from './meeting-deleter.service';
import MeetingRespondent from './meeting-respondent.entity';
import Meeting from './meeting.entity';
import { MeetingsController } from './meetings.controller';
import MeetingsService from './meetings.service';
import UsersModule from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Meeting, MeetingRespondent]),
    MailModule,
    RateLimiterModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService, MeetingDeleterService],
  exports: [MeetingsService],
})
export default class MeetingsModule {}
