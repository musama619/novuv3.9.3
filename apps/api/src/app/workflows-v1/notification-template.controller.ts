import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  buildWorkflowPreferencesFromPreferenceChannels,
  DEFAULT_WORKFLOW_PREFERENCES,
  ResourceOriginEnum,
  ResourceTypeEnum,
  UserSessionData,
} from '@novu/shared';
import { RequireAuthentication } from '../auth/framework/auth.decorator';
import { ExternalApiAccessible } from '../auth/framework/external-api.decorator';
import { RootEnvironmentGuard } from '../auth/framework/root-environment-guard.service';
import { DataBooleanDto } from '../shared/dtos/data-wrapper-dto';
import { ApiCommonResponses, ApiOkResponse, ApiResponse } from '../shared/framework/response.decorator';
import { UserSession } from '../shared/framework/user.decorator';
import { ChangeWorkflowStatusRequestDto, CreateWorkflowRequestDto, UpdateWorkflowRequestDto } from './dtos';
import { WorkflowResponse } from './dtos/workflow-response.dto';
import { WorkflowsResponseDto } from './dtos/workflows.response.dto';
import { WorkflowsRequestDto } from './dtos/workflows-request.dto';
import { CreateWorkflowQuery } from './queries';
import { ChangeTemplateActiveStatusCommand } from './usecases/change-template-active-status/change-template-active-status.command';
import { ChangeTemplateActiveStatus } from './usecases/change-template-active-status/change-template-active-status.usecase';
import { CreateWorkflowCommand } from './usecases/create-workflow/create-workflow.command';
import { CreateWorkflow } from './usecases/create-workflow/create-workflow.usecase';
import { DeleteNotificationTemplateCommand } from './usecases/delete-notification-template/delete-notification-template.command';
import { DeleteNotificationTemplate } from './usecases/delete-notification-template/delete-notification-template.usecase';
import { GetNotificationTemplateCommand } from './usecases/get-notification-template/get-notification-template.command';
import { GetNotificationTemplate } from './usecases/get-notification-template/get-notification-template.usecase';
import { GetNotificationTemplatesCommand } from './usecases/get-notification-templates/get-notification-templates.command';
import { GetNotificationTemplates } from './usecases/get-notification-templates/get-notification-templates.usecase';
import { UpdateWorkflowCommand } from './usecases/update-workflow/update-workflow.command';
import { UpdateWorkflow } from './usecases/update-workflow/update-workflow.usecase';

/**
 * @deprecated use controller in /workflows directory
 */

@ApiCommonResponses()
@ApiExcludeController()
@Controller('/notification-templates')
@UseInterceptors(ClassSerializerInterceptor)
@RequireAuthentication()
@ApiTags('Notification Templates')
export class NotificationTemplateController {
  constructor(
    private createWorkflowUsecase: CreateWorkflow,
    private updateWorkflowUsecase: UpdateWorkflow,
    private getNotificationTemplateUsecase: GetNotificationTemplate,
    private getNotificationTemplatesUsecase: GetNotificationTemplates,
    private deleteTemplateByIdUsecase: DeleteNotificationTemplate,
    private changeTemplateActiveStatusUsecase: ChangeTemplateActiveStatus
  ) {}

  @Get('')
  @ApiResponse(WorkflowResponse)
  @ApiOperation({
    summary: 'Get Notification templates',
    description: `Notification templates have been renamed to Workflows, Please use the new workflows controller`,
    deprecated: true,
  })
  @ExternalApiAccessible()
  getNotificationTemplates(
    @UserSession() user: UserSessionData,
    @Query() queryParams: WorkflowsRequestDto
  ): Promise<WorkflowsResponseDto> {
    return this.getNotificationTemplatesUsecase.execute(
      GetNotificationTemplatesCommand.create({
        organizationId: user.organizationId,
        userId: user._id,
        environmentId: user.environmentId,
        page: queryParams.page,
        limit: queryParams.limit,
        query: queryParams.query,
      })
    );
  }

  @Put('/:templateId')
  @ApiResponse(WorkflowResponse)
  @ApiOperation({
    summary: 'Update Notification template',
    description: `Notification templates have been renamed to Workflows, Please use the new workflows controller`,
    deprecated: true,
  })
  @ExternalApiAccessible()
  async updateTemplateById(
    @UserSession() user: UserSessionData,
    @Param('templateId') templateId: string,
    @Body() body: UpdateWorkflowRequestDto
  ): Promise<WorkflowResponse> {
    return await this.updateWorkflowUsecase.execute(
      UpdateWorkflowCommand.create({
        environmentId: user.environmentId,
        organizationId: user.organizationId,
        userId: user._id,
        id: templateId,
        name: body.name,
        tags: body.tags,
        description: body.description,
        workflowId: body.identifier,
        critical: body.critical,
        defaultPreferences: DEFAULT_WORKFLOW_PREFERENCES,
        userPreferences:
          body.preferenceSettings &&
          buildWorkflowPreferencesFromPreferenceChannels(body.critical, body.preferenceSettings),
        steps: body.steps,
        notificationGroupId: body.notificationGroupId,
        data: body.data,
        type: ResourceTypeEnum.REGULAR,
      })
    );
  }

  @Delete('/:templateId')
  @UseGuards(RootEnvironmentGuard)
  @ApiOkResponse({
    type: DataBooleanDto,
  })
  @ApiOperation({
    summary: 'Delete Notification template',
    description: `Notification templates have been renamed to Workflows, Please use the new workflows controller`,
    deprecated: true,
  })
  @ExternalApiAccessible()
  deleteTemplateById(@UserSession() user: UserSessionData, @Param('templateId') templateId: string): Promise<boolean> {
    return this.deleteTemplateByIdUsecase.execute(
      DeleteNotificationTemplateCommand.create({
        environmentId: user.environmentId,
        organizationId: user.organizationId,
        userId: user._id,
        templateId,
        type: ResourceTypeEnum.REGULAR,
      })
    );
  }

  @Get('/:workflowIdOrIdentifier')
  @ApiResponse(WorkflowResponse)
  @ApiOperation({
    summary: 'Get Notification template',
    description: `Notification templates have been renamed to Workflows, Please use the new workflows controller`,
    deprecated: true,
  })
  @ExternalApiAccessible()
  getNotificationTemplateById(
    @UserSession() user: UserSessionData,
    @Param('workflowIdOrIdentifier') workflowIdOrIdentifier: string
  ): Promise<WorkflowResponse> {
    return this.getNotificationTemplateUsecase.execute(
      GetNotificationTemplateCommand.create({
        environmentId: user.environmentId,
        organizationId: user.organizationId,
        userId: user._id,
        workflowIdOrIdentifier,
      })
    );
  }

  @Post('')
  @ExternalApiAccessible()
  @UseGuards(RootEnvironmentGuard)
  @ApiResponse(WorkflowResponse, 201)
  @ApiOperation({
    summary: 'Create Notification template',
    description: `Notification templates have been renamed to Workflows, Please use the new workflows controller`,
    deprecated: true,
  })
  create(
    @UserSession() user: UserSessionData,
    @Query() query: CreateWorkflowQuery,
    @Body() body: CreateWorkflowRequestDto
  ): Promise<WorkflowResponse> {
    return this.createWorkflowUsecase.execute(
      CreateWorkflowCommand.create({
        organizationId: user.organizationId,
        userId: user._id,
        environmentId: user.environmentId,
        name: body.name,
        tags: body.tags,
        description: body.description,
        steps: body.steps,
        notificationGroupId: body.notificationGroupId,
        notificationGroup: body.notificationGroup,
        active: body.active ?? false,
        draft: !body.active,
        critical: body.critical ?? false,
        defaultPreferences: DEFAULT_WORKFLOW_PREFERENCES,
        userPreferences:
          body.preferenceSettings &&
          buildWorkflowPreferencesFromPreferenceChannels(body.critical, body.preferenceSettings),
        blueprintId: body.blueprintId,
        data: body.data,
        __source: query?.__source,
        type: ResourceTypeEnum.REGULAR,
        origin: ResourceOriginEnum.NOVU_CLOUD,
      })
    );
  }

  @Put('/:templateId/status')
  @UseGuards(RootEnvironmentGuard)
  @ApiResponse(WorkflowResponse)
  @ApiOperation({
    summary: 'Update Notification template status',
    description: `Notification templates have been renamed to Workflows, Please use the new workflows controller`,
    deprecated: true,
  })
  @ExternalApiAccessible()
  changeActiveStatus(
    @UserSession() user: UserSessionData,
    @Body() body: ChangeWorkflowStatusRequestDto,
    @Param('templateId') templateId: string
  ): Promise<WorkflowResponse> {
    return this.changeTemplateActiveStatusUsecase.execute(
      ChangeTemplateActiveStatusCommand.create({
        organizationId: user.organizationId,
        userId: user._id,
        environmentId: user.environmentId,
        active: body.active,
        templateId,
      })
    );
  }
}
