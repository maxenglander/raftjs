import { IEndpoint } from './net/endpoint';

export interface ICluster {
    readonly servers: { [id: string]: IEndpoint };
}
