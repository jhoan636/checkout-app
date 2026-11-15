import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HandleGatewayEventUseCase } from '../../../application/use-cases/handle-gateway-event.use-case';
import { Env } from '../../config/env.validation';
import { parseGatewayEvent } from '../../gateway/gateway-event';

export interface WebhookAck {
  received: true;
}

const ACK: WebhookAck = { received: true };

/**
 * Receives payment notifications from the gateway. The gateway retries until
 * it gets a 200, so every authentic event is acknowledged, even one that this
 * application decides to ignore.
 */
@Controller('webhooks')
export class GatewayWebhookController {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly handleEvent: HandleGatewayEventUseCase,
  ) {}

  @Post('payment-gateway')
  @HttpCode(HttpStatus.OK)
  async receive(@Body() body: unknown): Promise<WebhookAck> {
    const event = parseGatewayEvent(
      body,
      this.config.get('GATEWAY_EVENTS_SECRET', { infer: true }),
    );
    if (!event.ok) {
      if (event.error === 'INVALID_SIGNATURE') {
        throw new UnauthorizedException();
      }
      return ACK;
    }

    await this.handleEvent.execute(event.value);
    return ACK;
  }
}
