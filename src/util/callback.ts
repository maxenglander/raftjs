export type Callback<T> = (value: T) => void;
export type ErrorFirstCallback<E, T> = (err: E, value: T) => void;
export type NoArgsCallback = () => void;
