import { IEndpoint } from '../../endpoint';
import { Callback, NoArgsCallback } from '../../../util/types';

export interface IConnectionRegistry<T> {
  count(): number;
  forEach(
    onEach: (endpoint: IEndpoint, connection: T) => void,
    onDone?: NoArgsCallback
  ): void;
  get(endpoint: IEndpoint): T;
  getAll(): T[];
  has(endpoint: IEndpoint): boolean;
  remove(endpoint: IEndpoint): void;
  removeEach(onRemove: Callback<T>, onDone?: NoArgsCallback): void;
  save(endpoint: IEndpoint, connection: T): boolean;
}
