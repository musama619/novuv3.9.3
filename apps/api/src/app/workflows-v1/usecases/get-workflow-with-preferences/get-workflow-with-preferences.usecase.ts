import { Injectable } from '@nestjs/common';
import {
  GetPreferences,
  GetPreferencesCommand,
  GetWorkflowByIdsUseCase,
  Instrument,
  InstrumentUsecase,
} from '@novu/application-generic';
import { NotificationTemplateEntity } from '@novu/dal';
import { buildWorkflowPreferencesFromPreferenceChannels, DEFAULT_WORKFLOW_PREFERENCES } from '@novu/shared';
import { WorkflowWithPreferencesResponseDto } from '../../dtos/get-workflow-with-preferences.dto';
import { GetWorkflowWithPreferencesCommand } from './get-workflow-with-preferences.command';

@Injectable()
export class GetWorkflowWithPreferencesUseCase {
  constructor(
    private getWorkflowByIdsUseCase: GetWorkflowByIdsUseCase,
    private getPreferences: GetPreferences
  ) {}

  @InstrumentUsecase()
  async execute(command: GetWorkflowWithPreferencesCommand): Promise<WorkflowWithPreferencesResponseDto> {
    const workflowEntity = await this.getWorkflowByIdsUseCase.execute({
      workflowIdOrInternalId: command.workflowIdOrInternalId,
      environmentId: command.environmentId,
      organizationId: command.organizationId,
      userId: command.userId,
      session: command.session,
    });

    const workflowPreferences = await this.getWorkflowPreferences(command, workflowEntity);

    /**
     * @deprecated - use `userPreferences` and `defaultPreferences` instead
     */
    const preferenceSettings = workflowPreferences
      ? GetPreferences.mapWorkflowPreferencesToChannelPreferences(workflowPreferences.preferences)
      : workflowEntity.preferenceSettings;
    const userPreferences = workflowPreferences
      ? workflowPreferences.source.USER_WORKFLOW
      : buildWorkflowPreferencesFromPreferenceChannels(workflowEntity.critical, workflowEntity.preferenceSettings);
    const defaultPreferences = workflowPreferences
      ? workflowPreferences.source.WORKFLOW_RESOURCE
      : DEFAULT_WORKFLOW_PREFERENCES;

    return {
      ...workflowEntity,
      preferenceSettings,
      userPreferences,
      defaultPreferences,
    };
  }

  @Instrument()
  private async getWorkflowPreferences(
    command: GetWorkflowWithPreferencesCommand,
    workflowEntity: NotificationTemplateEntity
  ) {
    return await this.getPreferences.safeExecute(
      GetPreferencesCommand.create({
        environmentId: command.environmentId,
        organizationId: command.organizationId,
        templateId: workflowEntity._id,
      })
    );
  }
}
