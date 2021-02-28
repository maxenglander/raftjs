export type Callback<T> = (value: T) => void;
export type ErrorFirstCallback<E, T> = (err: E, value: T) => void;
export interface IDetacher {
  detach: () => void;
}
export type NoArgsCallback = () => void;
export type PromiseCallback<T> = (value: T) => Promise<void>;
