//
import * as yargs from 'yargs';
import * as command from './command';

// Can be used by a CLI program to start a single
// `raftjs` server.
export function execute(args: ReadonlyArray<string>): void {
    yargs.strict()
        .demandCommand()
        .command(command.start)
        .parse(args);
}

export default { execute };
