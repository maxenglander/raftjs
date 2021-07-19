import { IRequest, IResponse } from '../api';
import { IEndpoint } from '../net/endpoint';
import {
  IRpcMessage
} from '../rpc/message';
import { IServerContext } from '../types';

export interface IState {
  enter: () => void;
  execute: (request: IRequest) => Promise<IResponse>;
  exit: () => void;
  getLeaderId: () => string;
  getType: () => StateType
  handleRpcMessage: (endpoint: IEndpoint, message: IRpcMessage) => void;
  isLeader: () => boolean;
}

export type StateFactory = (serverContext: IServerContext, leaderId: string) => IState;

export type StateType = 'candidate' | 'follower' | 'leader';
