import { IRpcMessage, RpcCallTypeMap, RpcProcedureTypeMap } from '../message';
import { IRpcReceiver } from '../@types';

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
