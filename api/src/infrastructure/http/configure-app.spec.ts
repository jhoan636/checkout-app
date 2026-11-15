import { INestApplication, ValidationPipe } from '@nestjs/common';
import { configureApp } from './configure-app';

describe('configureApp', () => {
  it('validates every request and refuses unknown fields', () => {
    const useGlobalPipes = jest.fn();

    configureApp({ useGlobalPipes } as unknown as INestApplication);

    const [pipe] = useGlobalPipes.mock.calls[0] as [ValidationPipe];
    expect(pipe).toBeInstanceOf(ValidationPipe);
    expect(pipe).toMatchObject({
      validatorOptions: { whitelist: true, forbidNonWhitelisted: true },
      isTransformEnabled: true,
    });
  });
});
