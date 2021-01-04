// A `yargs` builder for the `raftjs` server start
// command that validates that a `--config-file`
// argument is present and references an existing
// file.
import * as fs from 'fs';
import * as yargs from 'yargs';

import { IStartCommandCliOptions } from './@types';

export function builder(yargs: yargs.Argv): yargs.Argv<IStartCommandCliOptions> {
    return yargs.strict()
        .option('config-file', {
            coerce: function(path: string) {
                if(!fs.existsSync(path))
                    throw new Error(`Config file ${path} does not exist`);
                return path;
            },
            required: true,
            type: 'string'
        });
}
