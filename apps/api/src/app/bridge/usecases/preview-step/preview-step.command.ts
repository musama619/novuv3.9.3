import { EnvironmentWithUserCommand } from '@novu/application-generic';
import { JobStatusEnum, ResourceOriginEnum } from '@novu/shared';
import { SubscriberResponseDtoOptional } from '../../../subscribers/dtos';

export class PreviewStepCommand extends EnvironmentWithUserCommand {
  workflowId: string;
  stepId: string;
  controls: Record<string, unknown>;
  payload: Record<string, unknown>;
  subscriber?: SubscriberResponseDtoOptional;
  workflowOrigin: ResourceOriginEnum;
  state?: FrameworkPreviousStepsOutputState[];
  skipLayoutRendering?: boolean;
}
export type FrameworkPreviousStepsOutputState = {
  stepId: string;
  outputs: Record<string, unknown>;
  state: {
    status: JobStatusEnum;
    error?: string;
  };
};
