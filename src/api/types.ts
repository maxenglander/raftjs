export interface ICommandRequest {
  command: Uint8Array;
};

export interface ICommandResponse {
  result: Uint8Array;
}

export interface IInterregnumResponse {
  error: 'interregnum';
};

export interface INotReadyResponse {
  error: 'not-ready';
};

export interface IRedirectResponse {
  error: 'not-leader';
  redirectTo: {
    leaderId: string;
  }
};

export type IRequest = ICommandRequest;

export type IResponse = ICommandResponse | IInterregnumResponse | INotReadyResponse | IRedirectResponse;
