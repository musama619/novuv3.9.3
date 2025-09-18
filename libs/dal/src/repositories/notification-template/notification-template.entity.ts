import {
  BuilderFieldType,
  BuilderGroupValues,
  ControlSchemas,
  CustomDataType,
  FilterParts,
  IMessageFilter,
  INotificationTrigger,
  INotificationTriggerVariable,
  IPreferenceChannels,
  ITriggerReservedVariable,
  IWorkflowStepMetadata,
  ResourceOriginEnum,
  ResourceTypeEnum,
  RuntimeIssue,
  SeverityLevelEnum,
  StepIssues,
  TriggerTypeEnum,
  WorkflowStatusEnum,
} from '@novu/shared';
import { Types } from 'mongoose';
import type { ChangePropsValueType } from '../../types';
import type { EnvironmentId } from '../environment';
import { MessageTemplateEntity } from '../message-template';
import { NotificationGroupEntity } from '../notification-group';
import type { OrganizationId } from '../organization';
import { UserEntity } from '../user';

export class NotificationTemplateEntity {
  _id: string;

  name: string;

  description: string;

  active: boolean;

  draft: boolean;

  /** @deprecated - use `userPreferences` instead */
  preferenceSettings: IPreferenceChannels;

  /** @deprecated - use `userPreferences` instead */
  critical: boolean;

  tags: string[];

  steps: NotificationStepEntity[];

  _organizationId: OrganizationId;

  _creatorId: string;

  _environmentId: EnvironmentId;

  triggers: NotificationTriggerEntity[];

  _notificationGroupId: string;

  _parentId?: string;

  deleted: boolean;

  deletedAt: string;

  deletedBy: string;

  createdAt?: string;

  updatedAt?: string;

  _updatedBy?: string;

  readonly notificationGroup?: NotificationGroupEntity;

  readonly updatedBy?: UserEntity;

  isBlueprint: boolean;

  blueprintId?: string;

  data?: CustomDataType;

  type?: ResourceTypeEnum;

  origin?: ResourceOriginEnum;

  rawData?: any;

  payloadSchema?: any;

  validatePayload?: boolean;

  isTranslationEnabled?: boolean;

  issues: Record<string, RuntimeIssue[]>;

  status?: WorkflowStatusEnum;

  lastTriggeredAt?: string;

  lastPublishedAt?: string;

  _lastPublishedBy?: string;

  readonly lastPublishedBy?: UserEntity;

  severity?: SeverityLevelEnum;
}

export type NotificationTemplateDBModel = ChangePropsValueType<
  Omit<NotificationTemplateEntity, '_parentId'>,
  '_environmentId' | '_organizationId' | '_creatorId' | '_notificationGroupId' | '_updatedBy' | '_lastPublishedBy'
> & {
  _parentId?: Types.ObjectId;
};

export class NotificationTriggerEntity implements INotificationTrigger {
  type: TriggerTypeEnum;

  identifier: string;

  variables: INotificationTriggerVariable[];

  subscriberVariables?: Pick<INotificationTriggerVariable, 'name'>[];

  reservedVariables?: ITriggerReservedVariable[];
}

export class NotificationStepData {
  _id?: string;

  uuid?: string;

  stepId?: string;

  issues?: StepIssues;

  name?: string;

  _templateId: string;

  active?: boolean;

  replyCallback?: {
    active: boolean;
    url: string;
  };

  template?: MessageTemplateEntity;

  filters?: StepFilter[];

  _parentId?: string | null;

  metadata?: IWorkflowStepMetadata;

  shouldStopOnFail?: boolean;

  bridgeUrl?: string;
  /*
   * controlVariables exists
   * only on none production environment in order to provide stateless control variables on fly
   */
  controlVariables?: Record<string, unknown>;
  /**
   * @deprecated This property is deprecated and will be removed in future versions.
   * Use IMessageTemplate.controls
   */
  controls?: ControlSchemas;
}
export class NotificationStepEntity extends NotificationStepData {
  variants?: NotificationStepData[];
}

export class StepFilter implements IMessageFilter {
  isNegated?: boolean;
  type?: BuilderFieldType;
  value: BuilderGroupValues;
  children: FilterParts[];
}
