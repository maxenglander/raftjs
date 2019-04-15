# raftjs

This is a (partial) implementation of the [Raft](https://raft.github.io/raft.pdf)
protocol in JavaScript (by way of TypeScript). The purpose of this
implementation is to educate the author, and any interested readers,
in what an implementation might look like.

The implementation aims to be understandable, well-organized and extensible.
It attempts to follow the Raft protocol to the letter. However, there
are likely places where the language is misinterpreted or followed too
literally. There are likely to be many bugs and mistakes in this
implementation.

At the present time, the implementation includes only leader election,
The implementation does not presently include:

 * the leader accepting new entries from clients
 * the leader replicating log entries to followers
 * changes in cluster membership
 * snapshotting or log compaction

## Build

```
$> npm install
$> npm run build
```

## Docs

View the [annotated source](https://raftjs.maxenglander.com/annotated-source.html).

## Example usage

**Start Raftjs servers**
```
$> ./bin/rafjs start --config-file examples/configuration/server-a.json > /tmp/raftjs-server-a.log
$> RAFTJS_SERVER_A_PID=$!
$> ./bin/rafjs start --config-file examples/configuration/server-b.json > /tmp/raftjs-server-b.log
$> RAFTJS_SERVER_B_PID=$!
$> ./bin/rafjs start --config-file examples/configuration/server-c.json > /tmp/raftjs-server-c.log
$> RAFTJS_SERVER_C_PID=$!
```

**Check current leader**
```
$> grep leader /tmp/raftjs-server\*.log
/tmp/raftjs-server-a.log:[1555273638878] DEBUG (84785 on local): Votes obtained from cluster majority; transitioning to leader
```

**Kill the initial leader**
```
$> kill $RAFTJS_SERVER_A_PID
```

**Check the new leader**
```
$> grep leader /tmp/raftjs-server-\*log
/tmp/raftjs-server-a.log:[1555273638878] DEBUG (84785 on local): Votes obtained from cluster majority; transitioning to leader
/tmp/raftjs-server-b.log:[1555273762740] DEBUG (84787 on local): Votes obtained from cluster majority; transitioning to leader
```
