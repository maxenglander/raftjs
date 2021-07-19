export type ExecutionListener = (result: Uint8Array) => void;

export interface IObservableStateMachine extends IStateMachine {
  onceExecuted(command: Uint8Array, listener: ExecutionListener): void;
}
export interface IStateMachine {
  execute(command: Uint8Array): Promise<Uint8Array>;
}
