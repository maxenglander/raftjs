// A `yargs` CLI command module for the `raftjs`
// server start command.
import { handler } from './handler';
import { builder } from './builder';

export default {
    builder,
    command: 'start',
    description: 'Start RaftJS server.',
    handler
}
