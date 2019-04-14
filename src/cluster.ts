import { IEndpoint } from './net';

export interface ICluster {
    readonly servers: { [id: string]: IEndpoint };
}
