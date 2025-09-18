import { LogRepository, RequestLog } from '@novu/application-generic';
import { UserSessionData } from '@novu/shared';
import { getClientIp } from 'request-ip';
import { sanitizePayload } from '../../../utils/payload-sanitizer';
import { generateTransactionId } from '../helpers/generate-transaction-id';
import { RequestWithReqId } from '../middleware/request-id.middleware';
import { getRequestId } from './request-transaction.util';

export function buildLog(
  req: RequestWithReqId,
  statusCode: number,
  data: any,
  user: UserSessionData | null,
  duration: number = 0
): Omit<RequestLog, 'expires_at'> | null {
  // Skip logging when user data is incomplete to prevent orphaned log entries
  if (!user?._id || !user?.organizationId || !user?.environmentId || !user?.scheme) return null;

  const requestId = getRequestId(req);

  if (!requestId) {
    return null;
  }

  return {
    id: requestId,
    created_at: LogRepository.formatDateTime64(new Date()),
    path: req.path,
    url: req.originalUrl,
    url_pattern: req.route.path,
    hostname: req.hostname,
    status_code: statusCode,
    method: req.method,
    transaction_id: generateTransactionId(),
    ip: getClientIp(req) || '',
    user_agent: req.headers['user-agent'] || '',
    request_body: sanitizePayload(req.body),
    response_body: sanitizePayload(data),
    user_id: user._id,
    organization_id: user.organizationId,
    environment_id: user.environmentId,
    auth_type: user.scheme,
    duration_ms: duration,
  };
}
