import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { HealthResponse } from '../docs/responses.dto';

export interface HealthStatus {
  status: 'ok';
  database: 'up';
}

/** One database check is shared by every request for this long. */
export const HEALTH_CACHE_MS = 5_000;

// Called often by health checkers, so it is not rate limited. The answer is
// cached instead: a flood of requests cannot become a flood of queries.
@SkipThrottle()
@ApiTags('health')
@Controller('health')
export class HealthController {
  private lastCheck: { at: number; healthy: Promise<boolean> } | null = null;

  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Check that the API can reach its database' })
  @ApiOkResponse({ type: HealthResponse })
  async check(): Promise<HealthStatus> {
    if (!(await this.databaseAnswers())) {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    }
    return { status: 'ok', database: 'up' };
  }

  private databaseAnswers(): Promise<boolean> {
    const now = Date.now();
    if (!this.lastCheck || now - this.lastCheck.at >= HEALTH_CACHE_MS) {
      this.lastCheck = {
        at: now,
        healthy: this.dataSource.query('SELECT 1').then(
          () => true,
          () => false,
        ),
      };
    }
    return this.lastCheck.healthy;
  }
}
