export interface IEndpoint {
  equals: (endpoint: IEndpoint) => boolean;
  host: string;
  port: number;
  toString: () => string;
}
