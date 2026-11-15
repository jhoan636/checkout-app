import { randomUUID } from 'node:crypto';
import { Clock, IdGenerator } from '../../application/ports/system';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class UuidGenerator implements IdGenerator {
  uuid(): string {
    return randomUUID();
  }
}
