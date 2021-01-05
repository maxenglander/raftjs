// # raftjs
//
import { execute } from './cli'; // eslint-disable-line
//
// This annotated source is a single page containing
// almost all of the source code in the `raftjs` project.
//
// A bolded __filename.js__ above a horizontal rule
// in the left column next to `/** filename.js */` in the
// right-side column indicates the beginning of a new file.
//
// The annotated files are presented in reverse-dependency
// order, starting from the entry point to the `raftjs`
// application: `cli/index.js`. For those more interested
// in seeing the protocol implementation, `server/index.js`
// and `server/state/*.js` are the best places to start.
//
// References to the [Raft paper](https://raft.github.io/raft.pdf)
// are indicated with a quote containing a section sign (§)
// and number (e.g. "5.2"), and are *italicized*.
//
// Generally speaking, most of the annotations highlight
// areas of the code that closely correspond to writing
// in the Raft paper.
//
// Other parts of the code, such as the
// TCP transport, which are useful within the `raftjs` project
// but are not essential to the Raft protocol, are less
// heavily annotated.
//
// The project source code is written in TypeScript, but
// the annotated source is compiled to JavaScript for
// readability.
