import { ILog, ILogOptions, Log } from './log';

export function createLog(options?: ILogOptions): ILog {
    return new Log(options);
}
