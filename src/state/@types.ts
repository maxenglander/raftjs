import { IEndpoint } from '../net/endpoint';
import {
  IRpcMessage
} from '../rpc/message';
import { IServer } from '../@types';

export interface IState {
  enter: () => void;
  exit: () => void;
  getLeaderEndpoint: () => IEndpoint;
  getType: () => StateType
  handlePeerRpcMessage: (endpoint: IEndpoint, message: IRpcMessage) => void;
  isLeader: () => boolean;
}

export type StateFactory = (server: IServer, leaderEndpoint: IEndpoint) => IState;

export type StateType = 'candidate' | 'follower' | 'leader';
