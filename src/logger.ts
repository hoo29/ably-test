import Pino from 'pino';

export const logger = Pino({ level: 'debug', nestedKey: 'payload' });
