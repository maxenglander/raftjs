import { IRpcMessage } from '../@types';
import {
  IAppendEntriesRpcRequest,
  IAppendEntriesRpcResponse
} from './@types';

export function isAppendEntriesRpcRequest(message: IRpcMessage): message is IAppendEntriesRpcRequest {
  return message.callType == 'request' && message.procedureType == 'append-entries';
}

export function isAppendEntriesRpcResponse(
  message: IRpcMessage
): message is IAppendEntriesRpcResponse {
  return message.callType == 'response' && message.procedureType == 'append-entries';
}
