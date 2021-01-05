import * as Pino from 'pino';

export type ILogger = Pino.Logger;

export interface ILoggerOptions {
  level?: Level;
  prettyPrint?: boolean;
}

export type Level = Pino.Level;
