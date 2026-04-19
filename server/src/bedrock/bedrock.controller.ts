import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { BedrockService } from './bedrock.service';

@Controller('bedrock')
export class BedrockController {
  constructor(private readonly bedrockService: BedrockService) {}

  @Post('generate-description')
  async generateDescription(@Body('meetingName') meetingName: string) {
    if (!meetingName?.trim()) {
      throw new BadRequestException('Meeting name is required');
    }
    const description = await this.bedrockService.generateMeetingDescription(meetingName);
    return { description };
  }
}