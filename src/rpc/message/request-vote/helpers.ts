import { IRpcMessage } from '../@types';
import {
  IRequestVoteRpcRequest,
  IRequestVoteRpcResponse
} from './@types';

export function isRequestVoteRpcRequest(
  message: IRpcMessage
): message is IRequestVoteRpcRequest {
  return message.callType == 'request' && message.procedureType == 'request-vote';
}

export function isRequestVoteRpcResponse(
  message: IRpcMessage
): message is IRequestVoteRpcResponse {
  return message.callType == 'response' && message.procedureType == 'request-vote';
}
