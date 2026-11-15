import { createHash } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HandleGatewayEventUseCase } from '../../../application/use-cases/handle-gateway-event.use-case';
import { Env } from '../../config/env.validation';
import { GatewayWebhookController } from './gateway-webhook.controller';

const secret = 'test_events_secret';

const signedEvent = (eventName = 'transaction.updated') => {
  const transaction = {
    id: 'gw-123',
    status: 'APPROVED',
    reference: 'ORDER-1',
    amount_in_cents: 93_480_000,
  };
  const timestamp = 1_763_200_000;
  return {
    event: eventName,
    data: { transaction },
    timestamp,
    signature: {
      properties: [
        'transaction.id',
        'transaction.status',
        'transaction.amount_in_cents',
      ],
      checksum: createHash('sha256')
        .update(
          `${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${secret}`,
        )
        .digest('hex'),
    },
  };
};

const setup = () => {
  const execute = jest.fn().mockResolvedValue('APPLIED');
  const controller = new GatewayWebhookController(
    new ConfigService<Env, true>({ GATEWAY_EVENTS_SECRET: secret }),
    { execute } as unknown as HandleGatewayEventUseCase,
  );
  return { controller, execute };
};

describe('GatewayWebhookController', () => {
  it('passes an authentic event to the use case and acknowledges it', async () => {
    const { controller, execute } = setup();

    await expect(controller.receive(signedEvent())).resolves.toEqual({
      received: true,
    });
    expect(execute).toHaveBeenCalledWith({
      gatewayTransactionId: 'gw-123',
      status: 'APPROVED',
      reference: 'ORDER-1',
      amountInCents: 93_480_000,
    });
  });

  it('answers 401 and does nothing when the signature is wrong', async () => {
    const { controller, execute } = setup();
    const forged = {
      ...signedEvent(),
      signature: { ...signedEvent().signature, checksum: 'ab'.repeat(32) },
    };

    await expect(controller.receive(forged)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('answers 401 for a body that is not an event', async () => {
    const { controller } = setup();

    await expect(controller.receive(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('acknowledges an authentic event it does not handle, without acting', async () => {
    const { controller, execute } = setup();

    await expect(
      controller.receive(signedEvent('another.event')),
    ).resolves.toEqual({ received: true });
    expect(execute).not.toHaveBeenCalled();
  });
});
