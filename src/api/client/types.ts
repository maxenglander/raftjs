import { IEndpoint } from '../../net'

export interface ICommandRequest {
  command: Uint8Array;
};

export interface ICommandResponse {
  result: Uint8Array;
}

export interface INoLeaderResponse {
  error: 'no-leader';
};

export interface INotReadyResponse {
  error: 'not-ready';
};

export interface IRedirectResponse {
  error: 'not-leader';
  redirectTo: {
    leaderEndpoint: IEndpoint;
  }
};

export type IRequest = ICommandRequest;

export type IResponse = ICommandResponse | INoLeaderResponse | INotReadyResponse | IRedirectResponse;
