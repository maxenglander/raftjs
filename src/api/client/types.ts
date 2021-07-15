import { IEndpoint } from '../../net'

export interface ICommandClientRequest {
  command: Uint8Array;
};

export interface ICommandClientResponse {
  result: Uint8Array;
}

export interface INoLeaderClientResponse {
  error: 'no-leader';
};

export interface INotReadyClientResponse {
  error: 'not-ready';
};

export interface IRedirectClientResponse {
  error: 'not-leader';
  redirectTo: {
    leaderEndpoint: IEndpoint;
  }
};

export type IClientRequest = ICommandClientRequest;

export type IClientResponse = ICommandClientResponse | INoLeaderClientResponse | INotReadyClientResponse | IRedirectClientResponse;
