import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger';

import { HealthService } from './health.service.js';

/** Typed payload of the health route; the OpenAPI contract leans on it. */
export class HealthResponse {
  /** Always 'ok' while the process answers. */
  @ApiProperty({ type: String, enum: ['ok'], example: 'ok' })
  status!: 'ok';

  /** Version of the @bosco/api package. */
  @ApiProperty({ type: String, example: '0.0.1' })
  version!: string;

  /** Seconds since the process started, floored. */
  @ApiProperty({ type: Number, example: 42 })
  uptimeSeconds!: number;
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthService) private readonly healthService: HealthService,
  ) {}

  @Get()
  @ApiOkResponse({ type: HealthResponse })
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }
}
