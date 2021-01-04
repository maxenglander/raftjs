import { ElectionTimeoutInterval } from './@types';

// The Raft paper recommends an election timeout
// interval of 150–300 milliseconds:
// > *§9.3 "...We recommend using a conservative election timeout such as 150–300ms..."
export const DEFAULT_ELECTION_TIMEOUT_INTERVAL: ElectionTimeoutInterval = [
  150,
  300
];
