import { Body, Controller, Delete, Param, Post, Req, Scope } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions, ResourceCategory } from '@novu/application-generic';
import {
  AddressingTypeEnum,
  ApiRateLimitCategoryEnum,
  ApiRateLimitCostEnum,
  PermissionsEnum,
  ResourceEnum,
  TriggerRequestCategoryEnum,
  UserSessionData,
} from '@novu/shared';
import { v4 as uuidv4 } from 'uuid';
import { PayloadValidationExceptionDto } from '../../error-dto';
import { RequireAuthentication } from '../auth/framework/auth.decorator';
import { ExternalApiAccessible } from '../auth/framework/external-api.decorator';
import { ThrottlerCategory, ThrottlerCost } from '../rate-limiting/guards';
import { AnalyticsStrategyEnum, LogAnalytics } from '../shared/framework/analytics-logs.interceptor';
import {
  ApiCommonResponses,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiResponse,
} from '../shared/framework/response.decorator';
import { KeylessAccessible } from '../shared/framework/swagger/keyless.security';
import { SdkGroupName, SdkMethodName, SdkUsageExample } from '../shared/framework/swagger/sdk.decorators';
import { UserSession } from '../shared/framework/user.decorator';
import { RequestWithReqId } from '../shared/middleware/request-id.middleware';
import {
  BulkTriggerEventDto,
  TestSendEmailRequestDto,
  TriggerEventRequestDto,
  TriggerEventResponseDto,
  TriggerEventToAllRequestDto,
} from './dtos';
import { CancelDelayed, CancelDelayedCommand } from './usecases/cancel-delayed';
import { ParseEventRequest, ParseEventRequestMulticastCommand } from './usecases/parse-event-request';
import { ProcessBulkTrigger, ProcessBulkTriggerCommand } from './usecases/process-bulk-trigger';
import { SendTestEmail, SendTestEmailCommand } from './usecases/send-test-email';
import { TriggerEventToAll, TriggerEventToAllCommand } from './usecases/trigger-event-to-all';

function RequestAnalytics(strategy: AnalyticsStrategyEnum = AnalyticsStrategyEnum.BASIC) {
  return (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => {
    // Set analytics strategy as a property on the method
    const originalMethod = descriptor.value;
    originalMethod._analyticsStrategy = strategy;

    return descriptor;
  };
}

@ThrottlerCategory(ApiRateLimitCategoryEnum.TRIGGER)
@ResourceCategory(ResourceEnum.EVENTS)
@RequireAuthentication()
@ApiCommonResponses()
@Controller({
  path: 'events',
  scope: Scope.REQUEST,
})
@ApiTags('Events')
export class EventsController {
  constructor(
    private cancelDelayedUsecase: CancelDelayed,
    private triggerEventToAll: TriggerEventToAll,
    private sendTestEmail: SendTestEmail,
    private parseEventRequest: ParseEventRequest,
    private processBulkTriggerUsecase: ProcessBulkTrigger
  ) {}

  @KeylessAccessible()
  @ExternalApiAccessible()
  @Post('/trigger')
  @RequestAnalytics(AnalyticsStrategyEnum.EVENTS)
  @LogAnalytics(AnalyticsStrategyEnum.EVENTS)
  @ApiResponse(TriggerEventResponseDto, 201)
  @ApiResponse(PayloadValidationExceptionDto, 400, false, false, {
    description: 'Payload validation failed - returned when payload does not match the workflow schema',
  })
  @ApiOperation({
    summary: 'Trigger event',
    description: `
    Trigger event is the main (and only) way to send notifications to subscribers. The trigger identifier is used to match the particular workflow associated with it. Additional information can be passed according the body interface below.
    To prevent duplicate triggers, you can optionally pass a **transactionId** in the request body. If the same **transactionId** is used again, the trigger will be ignored. The retention period depends on your billing tier.`,
  })
  @SdkMethodName('trigger')
  @SdkUsageExample('Trigger Notification Event')
  @SdkGroupName('')
  @RequirePermissions(PermissionsEnum.EVENT_WRITE)
  async trigger(
    @UserSession() user: UserSessionData,
    @Req() req: RequestWithReqId,
    @Body() body: TriggerEventRequestDto
  ): Promise<TriggerEventResponseDto> {
    const result = await this.parseEventRequest.execute(
      ParseEventRequestMulticastCommand.create({
        userId: user._id,
        environmentId: user.environmentId,
        organizationId: user.organizationId,
        identifier: body.name,
        payload: body.payload || {},
        overrides: body.overrides || {},
        to: body.to,
        actor: body.actor,
        tenant: body.tenant,
        transactionId: body.transactionId,
        addressingType: AddressingTypeEnum.MULTICAST,
        requestCategory: TriggerRequestCategoryEnum.SINGLE,
        bridgeUrl: body.bridgeUrl,
        controls: body.controls,
        requestId: req._nvRequestId,
      })
    );

    return result as unknown as TriggerEventResponseDto;
  }

  @ExternalApiAccessible()
  @ThrottlerCost(ApiRateLimitCostEnum.BULK)
  @RequestAnalytics(AnalyticsStrategyEnum.EVENTS_BULK)
  @LogAnalytics(AnalyticsStrategyEnum.EVENTS_BULK)
  @Post('/trigger/bulk')
  @SdkMethodName('triggerBulk')
  @SdkUsageExample('Trigger Notification Events in Bulk')
  @SdkGroupName('')
  @ApiResponse(TriggerEventResponseDto, 201, true)
  @ApiResponse(PayloadValidationExceptionDto, 400, false, false, {
    description: 'Payload validation failed - returned when any event payload does not match the workflow schema',
  })
  @ApiOperation({
    summary: 'Bulk trigger event',
    description: `
      Using this endpoint you can trigger multiple events at once, to avoid multiple calls to the API.
      The bulk API is limited to 100 events per request.
    `,
  })
  @RequirePermissions(PermissionsEnum.EVENT_WRITE)
  async triggerBulk(
    @UserSession() user: UserSessionData,
    @Body() body: BulkTriggerEventDto,
    @Req() req: RequestWithReqId
  ): Promise<TriggerEventResponseDto[]> {
    return this.processBulkTriggerUsecase.execute(
      ProcessBulkTriggerCommand.create({
        userId: user._id,
        organizationId: user.organizationId,
        environmentId: user.environmentId,
        events: body.events,
        requestId: req._nvRequestId,
      })
    );
  }

  @ExternalApiAccessible()
  @ThrottlerCost(ApiRateLimitCostEnum.BULK)
  @RequestAnalytics(AnalyticsStrategyEnum.EVENTS)
  @LogAnalytics(AnalyticsStrategyEnum.EVENTS)
  @Post('/trigger/broadcast')
  @ApiResponse(TriggerEventResponseDto)
  @ApiResponse(PayloadValidationExceptionDto, 400, false, false, {
    description: 'Payload validation failed - returned when payload does not match the workflow schema',
  })
  @SdkMethodName('triggerBroadcast')
  @SdkUsageExample('Broadcast Event to All')
  @SdkGroupName('')
  @ApiOperation({
    summary: 'Broadcast event to all',
    description: `Trigger a broadcast event to all existing subscribers, could be used to send announcements, etc.
      In the future could be used to trigger events to a subset of subscribers based on defined filters.`,
  })
  @ApiCreatedResponse({
    description: 'Broadcast request has been registered successfully ',
    type: TriggerEventResponseDto,
  })
  @RequirePermissions(PermissionsEnum.EVENT_WRITE)
  async broadcastEventToAll(
    @UserSession() user: UserSessionData,
    @Body() body: TriggerEventToAllRequestDto,
    @Req() req: RequestWithReqId
  ): Promise<TriggerEventResponseDto> {
    const transactionId = body.transactionId || uuidv4();

    return this.triggerEventToAll.execute(
      TriggerEventToAllCommand.create({
        userId: user._id,
        environmentId: user.environmentId,
        organizationId: user.organizationId,
        identifier: body.name,
        payload: body.payload,
        tenant: body.tenant,
        transactionId,
        overrides: body.overrides || {},
        actor: body.actor,
        requestId: req._nvRequestId,
      })
    );
  }

  @Post('/test/email')
  @ApiExcludeEndpoint()
  @RequirePermissions(PermissionsEnum.EVENT_WRITE)
  async testEmailMessage(@UserSession() user: UserSessionData, @Body() body: TestSendEmailRequestDto): Promise<void> {
    return await this.sendTestEmail.execute(
      SendTestEmailCommand.create({
        subject: body.subject,
        payload: body.payload,
        contentType: body.contentType,
        content: body.content,
        preheader: body.preheader,
        layoutId: body.layoutId,
        to: body.to,
        userId: user._id,
        environmentId: user.environmentId,
        organizationId: user.organizationId,
        workflowId: body.workflowId,
        stepId: body.stepId,
        bridge: body.bridge,
        controls: body.controls,
      })
    );
  }

  @ExternalApiAccessible()
  @Delete('/trigger/:transactionId')
  @ApiOkResponse({
    type: Boolean,
  })
  @ApiOperation({
    summary: 'Cancel triggered event',
    description: `
    Using a previously generated transactionId during the event trigger,
     will cancel any active or pending workflows. This is useful to cancel active digests, delays etc...
    `,
  })
  @SdkMethodName('cancel')
  @SdkUsageExample('Cancel Triggered Event')
  @SdkGroupName('')
  @RequirePermissions(PermissionsEnum.EVENT_WRITE)
  async cancel(@UserSession() user: UserSessionData, @Param('transactionId') transactionId: string): Promise<boolean> {
    return await this.cancelDelayedUsecase.execute(
      CancelDelayedCommand.create({
        userId: user._id,
        environmentId: user.environmentId,
        organizationId: user.organizationId,
        transactionId,
      })
    );
  }
}
