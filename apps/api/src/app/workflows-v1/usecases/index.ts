import { GetWorkflowByIdsUseCase, ResourceValidatorService } from '@novu/application-generic';

import { CommunityOrganizationRepository } from '@novu/dal';
import { ChangeTemplateActiveStatus } from './change-template-active-status/change-template-active-status.usecase';
import { CreateWorkflow } from './create-workflow/create-workflow.usecase';
import { DeleteNotificationTemplate } from './delete-notification-template/delete-notification-template.usecase';
import { DeleteWorkflowUseCase } from './delete-workflow/delete-workflow.usecase';
import { GetActiveIntegrationsStatus } from './get-active-integrations-status/get-active-integrations-status.usecase';
import { GetNotificationTemplate } from './get-notification-template/get-notification-template.usecase';
import { GetNotificationTemplates } from './get-notification-templates/get-notification-templates.usecase';
import { GetWorkflowVariables } from './get-workflow-variables/get-workflow-variables.usecase';
import { GetWorkflowWithPreferencesUseCase } from './get-workflow-with-preferences/get-workflow-with-preferences.usecase';
import { UpdateWorkflow } from './update-workflow/update-workflow.usecase';

export const USE_CASES = [
  GetActiveIntegrationsStatus,
  ChangeTemplateActiveStatus,
  GetWorkflowByIdsUseCase,
  GetWorkflowWithPreferencesUseCase,
  CreateWorkflow,
  UpdateWorkflow,
  ResourceValidatorService,
  DeleteWorkflowUseCase,
  GetNotificationTemplates,
  GetNotificationTemplate,
  DeleteNotificationTemplate,
  GetWorkflowVariables,
  CommunityOrganizationRepository,
];
