import { Injectable } from '@nestjs/common';
import { EmailControlType, InstrumentUsecase, LayoutControlType } from '@novu/application-generic';
import {
  ChannelTypeEnum,
  LAYOUT_PREVIEW_EMAIL_STEP,
  LAYOUT_PREVIEW_WORKFLOW_ID,
  ResourceOriginEnum,
} from '@novu/shared';
import { PreviewStep, PreviewStepCommand } from '../../../bridge/usecases/preview-step';
import { ControlValueSanitizerService } from '../../../shared/services/control-value-sanitizer.service';
import { CreateVariablesObject, CreateVariablesObjectCommand } from '../../../shared/usecases/create-variables-object';
import { PayloadMergerService } from '../../../workflows-v2/usecases/preview/services/payload-merger.service';
import { PreviewPayloadProcessorService } from '../../../workflows-v2/usecases/preview/services/preview-payload-processor.service';
import { GenerateLayoutPreviewResponseDto } from '../../dtos/generate-layout-preview-response.dto';
import { GetLayoutCommand, GetLayoutUseCase } from '../get-layout';
import { PreviewLayoutCommand } from './preview-layout.command';
import { enhanceBodyForPreview } from './preview-utils';

@Injectable()
export class PreviewLayoutUsecase {
  constructor(
    private getLayoutUseCase: GetLayoutUseCase,
    private createVariablesObject: CreateVariablesObject,
    private controlValueSanitizer: ControlValueSanitizerService,
    private payloadProcessor: PreviewPayloadProcessorService,
    private payloadMerger: PayloadMergerService,
    private previewStepUsecase: PreviewStep
  ) {}

  @InstrumentUsecase()
  async execute(command: PreviewLayoutCommand): Promise<GenerateLayoutPreviewResponseDto> {
    const layout = await this.getLayoutUseCase.execute(
      GetLayoutCommand.create({
        layoutIdOrInternalId: command.layoutIdOrInternalId,
        environmentId: command.user.environmentId,
        organizationId: command.user.organizationId,
        userId: command.user._id,
      })
    );

    try {
      const controlValues = command.layoutPreviewRequestDto.controlValues || layout.controls.values || {};
      const variableSchema = layout.variables ?? {};

      // extract all variables from the control values and build the variables object
      const variablesObject = await this.createVariablesObject.execute(
        CreateVariablesObjectCommand.create({
          environmentId: command.user.environmentId,
          organizationId: command.user.organizationId,
          controlValues: Object.values(controlValues.email ?? {}),
          variableSchema,
        })
      );

      const sanitizedControls = this.controlValueSanitizer.sanitizeControlsForPreview(
        controlValues as Record<string, unknown>,
        'layout',
        ResourceOriginEnum.NOVU_CLOUD
      );

      const { previewTemplateData } = this.controlValueSanitizer.processControlValues(
        sanitizedControls,
        variableSchema,
        variablesObject
      );

      const payloadExample = await this.payloadMerger.mergePayloadExample({
        payloadExample: previewTemplateData.payloadExample,
        userPayloadExample: command.layoutPreviewRequestDto.previewPayload,
        user: command.user,
      });

      const cleanedPayloadExample = this.payloadProcessor.cleanPreviewExamplePayload(payloadExample);

      const { email } = previewTemplateData.controlValues as LayoutControlType;
      const editorType = email?.editorType ?? 'block';
      const body = email?.body ?? (editorType === 'block' ? '{}' : '');

      const executeOutput = await this.previewStepUsecase.execute(
        PreviewStepCommand.create({
          payload: (cleanedPayloadExample.payload ?? {}) as Record<string, unknown>,
          subscriber: cleanedPayloadExample.subscriber ?? {},
          // mapping the email layout controls to the email step controls
          controls: {
            subject: 'email-layout-preview',
            body: enhanceBodyForPreview(editorType, body),
            editorType,
          } as EmailControlType,
          environmentId: command.user.environmentId,
          organizationId: command.user.organizationId,
          stepId: LAYOUT_PREVIEW_EMAIL_STEP,
          userId: command.user._id,
          workflowId: LAYOUT_PREVIEW_WORKFLOW_ID,
          workflowOrigin: ResourceOriginEnum.NOVU_CLOUD,
          state: [],
        })
      );

      const { body: previewBody } = executeOutput.outputs as any;

      return {
        result: {
          preview: { body: previewBody },
          type: ChannelTypeEnum.EMAIL,
        },
        previewPayloadExample: payloadExample,
      };
    } catch (error) {
      /*
       * If preview execution fails, still return valid schema and payload example
       * but with an empty preview result
       */
      return {
        result: {
          type: ChannelTypeEnum.EMAIL,
        },
        previewPayloadExample: {},
      };
    }
  }
}
