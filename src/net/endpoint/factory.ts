import { IEndpoint } from './types';
import { Endpoint } from './endpoint';

// Create an `Endpoint` from a `{ host, port }` object.
export function createEndpoint(options: {
  host: string;
  port: number;
}): IEndpoint {
  return new Endpoint(options);
}
