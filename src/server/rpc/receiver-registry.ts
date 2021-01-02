import { RpcCallTypeMap, IRpcMessage, RpcProcedureTypeMap } from './message';
import { compilerError } from '../../util/compiler-error';
import { IRpcReceiver } from './';

export interface IRpcReceiverRegistry {
  add:    <P extends IRpcMessage['procedureType'], C extends IRpcMessage['callType']>(
      receiver: IRpcReceiver<RpcProcedureTypeMap[P], RpcCallTypeMap[C]>
  ) => void;
  getAll: <P extends IRpcMessage['procedureType'], C extends IRpcMessage['callType']>(
      procedureType: RpcProcedureTypeMap[P],
      callType: RpcCallTypeMap[C]
  ) => ReadonlySet<IRpcReceiver<RpcProcedureTypeMap[P], RpcCallTypeMap[C]>>;
  remove: <P extends IRpcMessage['procedureType'], C extends IRpcMessage['callType']>(
      receiver: IRpcReceiver<RpcProcedureTypeMap[P], RpcCallTypeMap[C]>
  ) => void;
}

// A data structure that maintains an `RpcReceiver` set for each
// kind of RPC message.
class RpcReceiverRegistry implements IRpcReceiverRegistry {
    private appendEntriesRequestReceivers:  Set<IRpcReceiver<'append-entries', 'request'>>;
    private appendEntriesResponseReceivers: Set<IRpcReceiver<'append-entries', 'response'>>;
    private requestVoteRequestReceivers:    Set<IRpcReceiver<'request-vote',  'request'>>;
    private requestVoteResponseReceivers:   Set<IRpcReceiver<'request-vote',  'response'>>;

    constructor() {
        this.appendEntriesRequestReceivers  = new Set<IRpcReceiver<'append-entries', 'request'>>();
        this.appendEntriesResponseReceivers = new Set<IRpcReceiver<'append-entries', 'response'>>(),
        this.requestVoteRequestReceivers    = new Set<IRpcReceiver<'request-vote',   'request'>>(),
        this.requestVoteResponseReceivers   = new Set<IRpcReceiver<'request-vote',   'response'>>();
    }

    // Add the provided `RpcReceiver` to the registry.
    public add<P extends IRpcMessage['procedureType'], C extends IRpcMessage['callType']>(
        receiver: IRpcReceiver<RpcProcedureTypeMap[P], RpcCallTypeMap[C]>
    ): void {
        const _procedureType: IRpcMessage['procedureType'] = receiver.procedureType,
            _callType: IRpcMessage['callType'] = receiver.callType;
        this.internalGetAll(_procedureType, _callType).add(receiver);
    }

    // Get every `RpcReceiver` registered for the provided RPC message call or response.
    public getAll<P extends IRpcMessage['procedureType'], C extends IRpcMessage['callType']>(
        procedureType: RpcProcedureTypeMap[P],
        callType: RpcCallTypeMap[C]
    ): ReadonlySet<IRpcReceiver<RpcProcedureTypeMap[P], RpcCallTypeMap[C]>> {
        type _ProcedureType = RpcProcedureTypeMap[P];
        type _CallType = RpcCallTypeMap[C];

        const _procedureType: _ProcedureType = procedureType,
            _callType: _CallType = callType,
            _receiverSet: Set<IRpcReceiver<_ProcedureType, _CallType>> = this.internalGetAll(_procedureType, _callType);

        return _receiverSet;
    }

    // Get a set of registered receivers based on the provided
    // procedure and call type.
    private internalGetAll<P extends IRpcMessage['procedureType'], C extends IRpcMessage['callType']>(
        procedureType: P,
        callType: C
    ): Set<IRpcReceiver<RpcProcedureTypeMap[P], RpcCallTypeMap[C]>> {
        type _ReturnType = Set<IRpcReceiver<RpcProcedureTypeMap[P], RpcCallTypeMap[C]>>;

        const _callType: IRpcMessage['callType'] = callType,
            _procedureType: IRpcMessage['procedureType'] = procedureType;

        switch(_procedureType) {
            case 'append-entries':
                switch(_callType) {
                    case 'request':
                        return this.appendEntriesRequestReceivers as _ReturnType;
                    case 'response':
                        return this.appendEntriesResponseReceivers as _ReturnType;
                    default:
                        // Used by TypeScript for [exhaustiveness
                        // checks](https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking).
                        return compilerError(_callType);
                } 
            case 'request-vote':
                switch(_callType) {
                    case 'request':
                        return this.requestVoteRequestReceivers as _ReturnType;
                    case 'response':
                        return this.requestVoteResponseReceivers as _ReturnType;
                    default:
                        // Used by TypeScript for [exhaustiveness
                        // checks](https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking).
                        return compilerError(_callType);
                } 
            default:
                // Used by TypeScript for [exhaustiveness
                // checks](https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking).
                return compilerError(_procedureType);
        }
    }

    // Remove the provided `RpcReceiver` to the registry.
    public remove<P extends IRpcMessage['procedureType'], C extends IRpcMessage['callType']>(
        receiver: IRpcReceiver<RpcProcedureTypeMap[P], RpcCallTypeMap[C]>
    ): void {
        const _procedureType: IRpcMessage['procedureType'] = receiver.procedureType,
            _callType: IRpcMessage['callType'] = receiver.callType;
        this.internalGetAll(_procedureType, _callType).delete(receiver);
    }
}

export function createRpcReceiverRegistry(): IRpcReceiverRegistry {
    return new RpcReceiverRegistry();
}
