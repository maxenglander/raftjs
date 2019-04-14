import * as Pino from 'pino';
const pino = require('pino');

export type ILogger = Pino.Logger;

export type Level = Pino.Level;

export interface ILoggerOptions {
    level?: Level;
    machineReadable?: boolean;
}

// Create a logger.
export function createLogger(options: ILoggerOptions = {}) {
    return pino({
        level: options.level ? options.level : 'error',
        prettyPrint: 'machineReadable' in options ? !options.machineReadable : true
    });
}
