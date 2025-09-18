import { EnvironmentTypeEnum, UiComponentEnum } from '@novu/shared';
import { EmailEditorSelect } from '@/components/email-editor-select';
import { DelayAmount } from '@/components/workflow-editor/steps/delay/delay-amount';
import { DigestKey } from '@/components/workflow-editor/steps/digest/digest-key';
import { DigestWindow } from '@/components/workflow-editor/steps/digest/digest-window';
import { EmailBody } from '@/components/workflow-editor/steps/email/email-body';
import { EmailSubject } from '@/components/workflow-editor/steps/email/email-subject';
import { InAppAction } from '@/components/workflow-editor/steps/in-app/in-app-action';
import { InAppAvatar } from '@/components/workflow-editor/steps/in-app/in-app-avatar';
import { InAppBody } from '@/components/workflow-editor/steps/in-app/in-app-body';
import { InAppRedirect } from '@/components/workflow-editor/steps/in-app/in-app-redirect';
import { InAppSubject } from '@/components/workflow-editor/steps/in-app/in-app-subject';
import { useEnvironment } from '@/context/environment/hooks';
import { useWorkflow } from '../workflow-provider';
import { BaseBody } from './base/base-body';
import { BaseSubject } from './base/base-subject';
import { DataObject } from './base/data-object';
import { LayoutSelect } from './email/layout-select';
import { useSaveForm } from './save-form-context';
import { BypassSanitizationSwitch } from './shared/bypass-sanitization-switch';

const EmailEditorSelectInternal = () => {
  const { isUpdatePatchPending } = useWorkflow();
  const { saveForm } = useSaveForm();
  const { currentEnvironment } = useEnvironment();

  return (
    <EmailEditorSelect
      isLoading={isUpdatePatchPending}
      saveForm={saveForm}
      disabled={currentEnvironment?.type !== EnvironmentTypeEnum.DEV}
    />
  );
};

export const getComponentByType = ({ component }: { component?: UiComponentEnum }) => {
  switch (component) {
    case UiComponentEnum.IN_APP_AVATAR: {
      return <InAppAvatar />;
    }

    case UiComponentEnum.IN_APP_SUBJECT: {
      return <InAppSubject />;
    }

    case UiComponentEnum.IN_APP_BODY: {
      return <InAppBody />;
    }

    case UiComponentEnum.IN_APP_BUTTON_DROPDOWN: {
      return <InAppAction />;
    }

    case UiComponentEnum.IN_APP_DISABLE_SANITIZATION_SWITCH:
      return <BypassSanitizationSwitch />;

    case UiComponentEnum.DATA: {
      return <DataObject />;
    }

    case UiComponentEnum.URL_TEXT_BOX: {
      return <InAppRedirect />;
    }

    case UiComponentEnum.DELAY_AMOUNT:
    case UiComponentEnum.DELAY_UNIT:
    case UiComponentEnum.DELAY_TYPE:
      return <DelayAmount />;

    case UiComponentEnum.EMAIL_EDITOR_SELECT: {
      return <EmailEditorSelectInternal />;
    }

    case UiComponentEnum.EMAIL_BODY:
    case UiComponentEnum.BLOCK_EDITOR:
      return <EmailBody />;

    case UiComponentEnum.TEXT_INLINE_LABEL: {
      return <EmailSubject />;
    }

    case UiComponentEnum.DIGEST_KEY: {
      return <DigestKey />;
    }

    case UiComponentEnum.DIGEST_AMOUNT:
    case UiComponentEnum.DIGEST_UNIT:
    case UiComponentEnum.DIGEST_CRON:
      return <DigestWindow />;

    case UiComponentEnum.PUSH_BODY: {
      return <BaseBody />;
    }

    case UiComponentEnum.PUSH_SUBJECT: {
      return <BaseSubject />;
    }

    case UiComponentEnum.SMS_BODY: {
      return <BaseBody />;
    }

    case UiComponentEnum.CHAT_BODY: {
      return <BaseBody />;
    }

    case UiComponentEnum.LAYOUT_SELECT: {
      return <LayoutSelect />;
    }

    default: {
      return null;
    }
  }
};
