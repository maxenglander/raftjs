import { IState } from './';

// The "no-op" state is not part of the Raft
// protocol. It is used by `Server` as a
// [null object](https://en.wikipedia.org/wiki/Null_object_pattern)
// to simplify guarding against null references.
export function createNoopState(): IState {
    return {
        enter() {},
        exit() {},
        type: null
    };
}
