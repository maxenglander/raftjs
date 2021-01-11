// A `yargs` command handler for the `raftjs` server start
// command that parses a `--config-file` and starts a `raftjs`
// server.
import { createServer } from '../../../factory';

import { IStartCommandCliOptions } from './@types';
import { parseConfigFile } from './config-file-parser';

export function handler(argv: IStartCommandCliOptions): void {
  const serverOptions = parseConfigFile(argv['config-file']),
    server = createServer(serverOptions);

  server.start();

  function exit() {
    server.stop();
  }

  process.on('SIGINT', exit);
  process.on('SIGTERM', exit);
}
