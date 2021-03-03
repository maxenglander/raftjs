import { IEndpoint } from '../net/endpoint';
import {
  IRpcMessage
} from '../rpc/message';
import { IRequest, IResponse } from '../api/client';
import { IServer } from '../types';

export interface IState {
  enter: () => void;
  exit: () => void;
  getLeaderEndpoint: () => IEndpoint;
  getType: () => StateType
  handleRequest: (request: IRequest) => Promise<IResponse>;
  handleRpcMessage: (endpoint: IEndpoint, message: IRpcMessage) => void;
  isLeader: () => boolean;
}

export type StateFactory = (server: IServer, leaderEndpoint: IEndpoint) => IState;

export type StateType = 'candidate' | 'follower' | 'leader';
