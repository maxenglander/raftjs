import { ExecutionListener, IObservableStateMachine, IStateMachine } from './types';

export class ObservableStateMachine implements IObservableStateMachine {
  private executionListeners: Map<Uint8Array, Set<ExecutionListener>>;
  private stateMachine: IStateMachine;

  constructor(stateMachine: IStateMachine) {
    this.executionListeners = new Map();
    this.stateMachine = stateMachine;
  }

  public execute(command: Uint8Array): Promise<Uint8Array> {
    return this.stateMachine.execute(command).then(result => {
      this.notifyExecuted(command, result);
      return result;
    });
  }

  private notifyExecuted(command: Uint8Array, result: Uint8Array): void {
    if (this.executionListeners.has(command)) {
      for (let listener of this.executionListeners.get(command)) {
        listener(result);
      }
      this.executionListeners.delete(command);
    }
  }

  public onceExecuted(command: Uint8Array, listener: ExecutionListener): void {
    if (!this.executionListeners.has(command)) {
      this.executionListeners.set(command, new Set());
    }
    this.executionListeners.get(command).add(listener);
  }
}
