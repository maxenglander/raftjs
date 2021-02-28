import { ILog, ILogOptions } from './types';
import { Log } from './log';

export function createLog(options?: ILogOptions): ILog {
  return new Log(options);
}
