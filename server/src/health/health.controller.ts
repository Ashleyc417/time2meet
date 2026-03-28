import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @ApiOperation({ summary: 'ALB health check', operationId: 'healthCheck' })
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
