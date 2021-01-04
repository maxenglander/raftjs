import * as Pino from 'pino';

export type ILogger = Pino.Logger;

export type Level = Pino.Level;

export interface ILoggerOptions {
  level?: Level;
  machineReadable?: boolean;
}
