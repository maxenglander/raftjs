import { IEndpoint } from '../net/endpoint';
import {
  IAppendEntriesRpcRequest,
  IAppendEntriesRpcResponse,
  IRequestVoteRpcRequest,
  IRequestVoteRpcResponse
} from '../rpc/message';
import { IServer } from '../@types';

export interface IState {
  enter: () => void;
  exit: () => void;
  getLeaderEndpoint: () => IEndpoint;
  getType: () => StateType
  isLeader: () => boolean;
  onAppendEntriesRpcRequest: (endpoint: IEndpoint, message: IAppendEntriesRpcRequest) => void;
  onAppendEntriesRpcResponse: (endpoint: IEndpoint, message: IAppendEntriesRpcResponse) => void;
  onRequestVoteRpcRequest: (endpoint: IEndpoint, message: IRequestVoteRpcRequest) => void;
  onRequestVoteRpcResponse: (endpoint: IEndpoint, message: IRequestVoteRpcResponse) => void;
}

export type StateFactory = (server: IServer, lastState: IState) => IState;

export type StateTransition = (nextState: StateType | IState) => void;

export type StateType = 'candidate' | 'follower' | 'leader';
