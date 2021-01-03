import * as Pino from 'pino';
const pino = require('pino');

export type ILogger = Pino.Logger;

export type Level = Pino.Level;

export interface ILoggerOptions {
    level?: Level;
    machineReadable?: boolean;
}
