import { createHmac } from 'node:crypto';
import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EnvironmentRepository } from '@novu/dal';
import {
  GetActionEnum,
  HttpHeaderKeysEnum,
  HttpQueryKeysEnum,
  isFrameworkError,
  PostActionEnum,
} from '@novu/framework/internal';
import { ResourceOriginEnum } from '@novu/shared';
import got, {
  CacheError,
  HTTPError,
  MaxRedirectsError,
  OptionsOfTextResponseBody,
  ParseError,
  ReadError,
  RequestError,
  TimeoutError,
  UnsupportedProtocolError,
  UploadError,
} from 'got';
import { HttpRequestHeaderKeysEnum } from '../../http';
import { Instrument, InstrumentUsecase } from '../../instrumentation';
import { PinoLogger } from '../../logging';
import { BRIDGE_EXECUTION_ERROR } from '../../utils';
import { GetDecryptedSecretKey, GetDecryptedSecretKeyCommand } from '../get-decrypted-secret-key';
import { BridgeError, ExecuteBridgeRequestCommand, ExecuteBridgeRequestDto } from './execute-bridge-request.command';

const inTestEnv = process.env.NODE_ENV === 'test';

const RETRY_BASE_INTERVAL_IN_MS = inTestEnv ? 50 : 500;

export const DEFAULT_TIMEOUT = 5_000; // 5 seconds
export const DEFAULT_RETRIES_LIMIT = 3;
export const RETRYABLE_HTTP_CODES: number[] = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  503, // Service Unavailable
  504, // Gateway Timeout
  // https://developers.cloudflare.com/support/troubleshooting/cloudflare-errors/troubleshooting-cloudflare-5xx-errors/
  521, // CloudFlare web server is down
  522, // CloudFlare connection timed out
  524, // CloudFlare a timeout occurred
];
export const RETRYABLE_ERROR_CODES: string[] = [
  'EAI_AGAIN', //    DNS resolution failed, retry
  'ECONNREFUSED', // Connection refused by the server
  'ECONNRESET', //   Connection was forcibly closed by a peer
  'EADDRINUSE', //   Address already in use
  'EPIPE', //        Broken pipe
  'ETIMEDOUT', //    Operation timed out
  'ENOTFOUND', //    DNS lookup failed
  'EHOSTUNREACH', // No route to host
  'ENETUNREACH', //  Network is unreachable
];

const LOG_CONTEXT = 'ExecuteBridgeRequest';

/*
 * The error code returned by the tunneling service.
 * TODO: replace with a constant from the tunneling client.
 */
const TUNNEL_ERROR_CODE = 'TUNNEL_ERROR';

type TunnelResponseError = {
  code: string;
  message: string;
};

/**
 * A wrapper around the BridgeError that is thrown by the ExecuteBridgeRequest usecase.
 */
class BridgeRequestError extends HttpException {
  constructor(private bridgeError: BridgeError) {
    super(
      {
        message: bridgeError.message,
        code: bridgeError.code,
        data: bridgeError.data,
      },
      bridgeError.statusCode,
      {
        cause: bridgeError.cause,
      }
    );
  }
}

@Injectable()
export class ExecuteBridgeRequest {
  constructor(
    private environmentRepository: EnvironmentRepository,
    private getDecryptedSecretKey: GetDecryptedSecretKey,
    private logger: PinoLogger
  ) {
    this.logger.setContext(this.constructor.name);
  }

  @InstrumentUsecase()
  async execute<T extends PostActionEnum | GetActionEnum>(
    command: ExecuteBridgeRequestCommand
  ): Promise<ExecuteBridgeRequestDto<T>> {
    const environment = await this.environmentRepository.findOne({
      _id: command.environmentId,
    });

    if (!environment) {
      throw new NotFoundException(`Environment ${command.environmentId} not found`);
    }

    const bridgeUrl = this.getBridgeUrl(
      environment.bridge?.url || environment.echo?.url,
      command.environmentId,
      command.workflowOrigin,
      command.statelessBridgeUrl,
      command.action
    );

    this.logger.info(
      `Resolved bridge URL: ${bridgeUrl} for environment ${command.environmentId} and origin ${command.workflowOrigin}`
    );

    const retriesLimit = command.retriesLimit || DEFAULT_RETRIES_LIMIT;
    const bridgeActionUrl = new URL(bridgeUrl);
    bridgeActionUrl.searchParams.set(HttpQueryKeysEnum.ACTION, command.action);
    Object.entries(command.searchParams || {}).forEach(([key, value]) => {
      bridgeActionUrl.searchParams.set(key, value);
    });

    const url = bridgeActionUrl.toString();
    const options: OptionsOfTextResponseBody = {
      timeout: DEFAULT_TIMEOUT,
      json: command.event,
      retry: {
        limit: retriesLimit,
        methods: ['GET', 'POST'],
        statusCodes: RETRYABLE_HTTP_CODES,
        errorCodes: RETRYABLE_ERROR_CODES,
        calculateDelay: ({ attemptCount, error }) => {
          if (attemptCount > retriesLimit) {
            this.logger.info(`Exceeded retry limit of ${retriesLimit}. Stopping retries.`);

            return 0;
          }

          // Check if the error status code is in our retryable codes
          if (error?.response?.statusCode && RETRYABLE_HTTP_CODES.includes(error.response.statusCode)) {
            const delay = 2 ** attemptCount * RETRY_BASE_INTERVAL_IN_MS;
            this.logger.info(`Retryable status code ${error.response.statusCode} detected. Retrying in ${delay}ms`);

            return delay;
          }

          // Check if the error code is in our retryable error codes
          if (error?.code && RETRYABLE_ERROR_CODES.includes(error.code)) {
            const delay = 2 ** attemptCount * RETRY_BASE_INTERVAL_IN_MS;
            this.logger.info(`Retryable error code ${error.code} detected. Retrying in ${delay}ms`);

            return delay;
          }

          this.logger.info({ err: error }, 'Error is not retryable. Stopping retry attempts.');

          return 0; // Don't retry for other errors
        },
      },
      https: {
        /*
         * Reject self-signed and invalid certificates in Production environments but allow them in Development
         * as it's common for developers to use self-signed certificates in local environments.
         */
        rejectUnauthorized: environment.name.toLowerCase() === 'production',
      },
    };

    const request = [PostActionEnum.EXECUTE, PostActionEnum.PREVIEW].includes(command.action as PostActionEnum)
      ? got.post
      : got.get;

    const headers = await this.buildRequestHeaders(command);

    this.logger.info(`Making bridge request to \`${url}\``);
    try {
      return await request(url, {
        ...options,
        headers,
      }).json();
    } catch (error) {
      await this.handleResponseError(error, bridgeUrl, command.processError);
    }
  }

  @Instrument()
  private async buildRequestHeaders(command: ExecuteBridgeRequestCommand) {
    const novuSignatureHeader = await this.buildRequestSignature(command);

    return {
      [HttpRequestHeaderKeysEnum.BYPASS_TUNNEL_REMINDER]: 'true',
      [HttpRequestHeaderKeysEnum.CONTENT_TYPE]: 'application/json',
      [HttpHeaderKeysEnum.NOVU_SIGNATURE]: novuSignatureHeader,
    };
  }

  @Instrument()
  private async buildRequestSignature(command: ExecuteBridgeRequestCommand) {
    const secretKey = await this.getDecryptedSecretKey.execute(
      GetDecryptedSecretKeyCommand.create({
        environmentId: command.environmentId,
      })
    );

    const timestamp = Date.now();
    const novuSignatureHeader = `t=${timestamp},v1=${this.createHmacBySecretKey(
      secretKey,
      timestamp,
      command.event || {}
    )}`;

    return novuSignatureHeader;
  }

  @Instrument()
  private createHmacBySecretKey(secretKey: string, timestamp: number, payload: unknown) {
    const publicKey = `${timestamp}.${JSON.stringify(payload)}`;

    return createHmac('sha256', secretKey).update(publicKey).digest('hex');
  }

  /**
   * Returns the bridge URL based on the workflow origin and statelessBridgeUrl.
   *
   * - Novu Cloud workflows go to the Novu API Bridge
   * - External workflows go to the Client Bridge
   *
   * @param environmentBridgeUrl - The URL of the bridge app.
   * @param environmentId - The ID of the environment.
   * @param workflowOrigin - The origin of the workflow.
   * @param statelessBridgeUrl - The URL of the stateless bridge app.
   * @returns The correct bridge URL.
   */
  @Instrument()
  private getBridgeUrl(
    environmentBridgeUrl: string,
    environmentId: string,
    workflowOrigin: ResourceOriginEnum,
    statelessBridgeUrl?: string,
    action?: PostActionEnum | GetActionEnum
  ): string {
    if (statelessBridgeUrl) {
      return statelessBridgeUrl;
    }

    switch (workflowOrigin) {
      case ResourceOriginEnum.NOVU_CLOUD: {
        const apiUrl = this.getApiUrl(action);

        return `${apiUrl}/v1/environments/${environmentId}/bridge`;
      }
      case ResourceOriginEnum.EXTERNAL: {
        if (!environmentBridgeUrl) {
          throw new BadRequestException({
            code: BRIDGE_EXECUTION_ERROR.INVALID_BRIDGE_URL.code,
            message: BRIDGE_EXECUTION_ERROR.INVALID_BRIDGE_URL.message(environmentBridgeUrl),
          });
        }

        return environmentBridgeUrl;
      }
      default:
        throw new Error(`Unsupported workflow origin: ${workflowOrigin}`);
    }
  }

  private getApiUrl(action: PostActionEnum | GetActionEnum): string {
    const baseUrl =
      action === PostActionEnum.PREVIEW
        ? `http://localhost:${process.env.PORT}`
        : process.env.API_INTERNAL_ORIGIN || process.env.API_ROOT_URL;

    if (!baseUrl) {
      throw new Error('API URL is not properly configured');
    }

    // Ensure the URL doesn't end with a slash
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    // Add GLOBAL_CONTEXT_PATH and API_CONTEXT_PATH if they exist
    const contextPath = [
      process.env.GLOBAL_CONTEXT_PATH,
      action === PostActionEnum.PREVIEW ? process.env.API_CONTEXT_PATH : undefined,
    ]
      .filter(Boolean)
      .join('/');

    // Only append context path if it's not empty
    return contextPath ? `${cleanBaseUrl}/${contextPath}` : cleanBaseUrl;
  }

  @Instrument()
  private async handleResponseError(
    error: unknown,
    url: string,
    processError: ExecuteBridgeRequestCommand['processError']
  ) {
    let bridgeErrorData: Pick<BridgeError, 'data' | 'code' | 'statusCode' | 'message' | 'cause'>;
    if (error instanceof RequestError) {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(error.response.body as string);
      } catch (e) {
        // If the body is not valid JSON, we'll just use an empty object.
        body = {};
      }

      if (error instanceof HTTPError && isFrameworkError(body)) {
        // Handle known Framework errors. Propagate the error code and message.
        bridgeErrorData = {
          data: body.data,
          code: body.code,
          message: body.message,
          statusCode: error.response.statusCode,
        };
      } else if (error instanceof TimeoutError) {
        this.logger.error(`Bridge request timeout for \`${url}\``);
        bridgeErrorData = {
          code: BRIDGE_EXECUTION_ERROR.BRIDGE_REQUEST_TIMEOUT.code,
          message: BRIDGE_EXECUTION_ERROR.BRIDGE_REQUEST_TIMEOUT.message(url),
          statusCode: HttpStatus.REQUEST_TIMEOUT,
        };
      } else if (error instanceof UnsupportedProtocolError) {
        this.logger.error(`Unsupported protocol for \`${url}\``);
        bridgeErrorData = {
          code: BRIDGE_EXECUTION_ERROR.UNSUPPORTED_PROTOCOL.code,
          message: BRIDGE_EXECUTION_ERROR.UNSUPPORTED_PROTOCOL.message(url),
          statusCode: HttpStatus.BAD_REQUEST,
        };
      } else if (error instanceof ReadError) {
        this.logger.error(`Response body could not be read for \`${url}\``);
        bridgeErrorData = {
          code: BRIDGE_EXECUTION_ERROR.RESPONSE_READ_ERROR.code,
          message: BRIDGE_EXECUTION_ERROR.RESPONSE_READ_ERROR.message(url),
          statusCode: HttpStatus.BAD_REQUEST,
        };
      } else if (error instanceof UploadError) {
        this.logger.error(`Error uploading request body for \`${url}\``);
        bridgeErrorData = {
          code: BRIDGE_EXECUTION_ERROR.REQUEST_UPLOAD_ERROR.code,
          message: BRIDGE_EXECUTION_ERROR.REQUEST_UPLOAD_ERROR.message(url),
          statusCode: HttpStatus.BAD_REQUEST,
        };
      } else if (error instanceof CacheError) {
        this.logger.error(`Error caching request for \`${url}\``);
        bridgeErrorData = {
          code: BRIDGE_EXECUTION_ERROR.REQUEST_CACHE_ERROR.code,
          message: BRIDGE_EXECUTION_ERROR.REQUEST_CACHE_ERROR.message(url),
          statusCode: HttpStatus.BAD_REQUEST,
        };
      } else if (error instanceof MaxRedirectsError) {
        this.logger.error(`Maximum redirects exceeded for \`${url}\``);
        bridgeErrorData = {
          message: BRIDGE_EXECUTION_ERROR.MAXIMUM_REDIRECTS_EXCEEDED.message(url),
          code: BRIDGE_EXECUTION_ERROR.MAXIMUM_REDIRECTS_EXCEEDED.code,
          statusCode: HttpStatus.BAD_REQUEST,
        };
      } else if (error instanceof ParseError) {
        this.logger.error(`Bridge URL response code is 2xx, but parsing body fails. \`${url}\``);
        bridgeErrorData = {
          message: BRIDGE_EXECUTION_ERROR.MAXIMUM_REDIRECTS_EXCEEDED.message(url),
          code: BRIDGE_EXECUTION_ERROR.MAXIMUM_REDIRECTS_EXCEEDED.code,
          statusCode: HttpStatus.BAD_REQUEST,
        };
      } else if (body.code === TUNNEL_ERROR_CODE) {
        // Handle known tunnel errors
        const tunnelBody = body as TunnelResponseError;
        this.logger.error(`Could not establish tunnel connection for \`${url}\`. Error: \`${tunnelBody.message}\``);
        bridgeErrorData = {
          message: BRIDGE_EXECUTION_ERROR.TUNNEL_NOT_FOUND.message(url),
          code: BRIDGE_EXECUTION_ERROR.TUNNEL_NOT_FOUND.code,
          statusCode: HttpStatus.NOT_FOUND,
        };
      } else if (error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
        this.logger.error(
          `Bridge URL is uing a self-signed certificate that is not allowed for production environments. \`${url}\``
        );
        bridgeErrorData = {
          message: BRIDGE_EXECUTION_ERROR.SELF_SIGNED_CERTIFICATE.message(url),
          code: BRIDGE_EXECUTION_ERROR.SELF_SIGNED_CERTIFICATE.code,
          statusCode: HttpStatus.BAD_REQUEST,
        };
      } else if (error.response?.statusCode === 502) {
        /*
         * Tunnel was live, but the Bridge endpoint was down.
         * 502 is thrown by the tunnel service when the Bridge endpoint is not reachable.
         */
        this.logger.error(`Local Bridge endpoint not found for \`${url}\``);
        bridgeErrorData = {
          message: BRIDGE_EXECUTION_ERROR.BRIDGE_ENDPOINT_NOT_FOUND.message(url),
          code: BRIDGE_EXECUTION_ERROR.BRIDGE_ENDPOINT_NOT_FOUND.code,
          statusCode: HttpStatus.NOT_FOUND,
        };
      } else if (error.response?.statusCode === 404 || RETRYABLE_ERROR_CODES.includes(error.code)) {
        this.logger.error(`Bridge endpoint unavailable for \`${url}\``);

        let codeToThrow: string;
        if (RETRYABLE_ERROR_CODES.includes(error.code)) {
          codeToThrow = error.code;
        } else {
          codeToThrow = BRIDGE_EXECUTION_ERROR.BRIDGE_ENDPOINT_UNAVAILABLE.code;
        }
        bridgeErrorData = {
          message: BRIDGE_EXECUTION_ERROR.BRIDGE_ENDPOINT_UNAVAILABLE.message(url),
          code: codeToThrow,
          statusCode: HttpStatus.BAD_REQUEST,
        };
      } else if (error.response?.statusCode === 405) {
        this.logger.error(`Bridge endpoint method not configured for \`${url}\``);
        bridgeErrorData = {
          message: BRIDGE_EXECUTION_ERROR.BRIDGE_METHOD_NOT_CONFIGURED.message(url),
          code: BRIDGE_EXECUTION_ERROR.BRIDGE_METHOD_NOT_CONFIGURED.code,
          statusCode: HttpStatus.BAD_REQUEST,
        };
      } else if (error.response.statusCode === 413) {
        this.logger.error(`Payload too large for \`${url}\``);
        bridgeErrorData = {
          message: BRIDGE_EXECUTION_ERROR.PAYLOAD_TOO_LARGE.message(url),
          code: BRIDGE_EXECUTION_ERROR.PAYLOAD_TOO_LARGE.code,
          statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        };
      } else {
        this.logger.error(
          { err: error },
          `Unknown bridge request error calling \`${url}\`: \`${JSON.stringify(body)}\``
        );
        bridgeErrorData = {
          message: BRIDGE_EXECUTION_ERROR.UNKNOWN_BRIDGE_REQUEST_ERROR.message(url),
          code: BRIDGE_EXECUTION_ERROR.UNKNOWN_BRIDGE_REQUEST_ERROR.code,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } else {
      this.logger.error({ err: error }, `Unknown bridge non-request error calling \`${url}\``);
      bridgeErrorData = {
        message: BRIDGE_EXECUTION_ERROR.UNKNOWN_BRIDGE_NON_REQUEST_ERROR.message(url),
        code: BRIDGE_EXECUTION_ERROR.UNKNOWN_BRIDGE_NON_REQUEST_ERROR.code,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    const fullBridgeError: BridgeError = {
      ...bridgeErrorData,
      cause: error,
      url,
    };

    if (processError) {
      await processError(fullBridgeError);
    }

    throw new BridgeRequestError(fullBridgeError);
  }
}
