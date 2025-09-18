import { useUser } from '@clerk/clerk-react';
import { Inbox, InboxContent, InboxProps } from '@novu/react';
import { useNavigate } from 'react-router-dom';
import { API_HOSTNAME, WEBSOCKET_HOSTNAME } from '../../config';
import { useAuth } from '../../context/auth/hooks';
import { useFetchEnvironments } from '../../context/environment/hooks';

const defaultTabs = [
  {
    label: 'All',
    filter: { tags: [] },
  },
  {
    label: 'Promotions',
    filter: { tags: ['promotions'] },
  },
  {
    label: 'Security Alerts',
    filter: { tags: ['security', 'alert'] },
  },
];

export function InboxPreviewContent() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { user } = useUser();
  const { environments } = useFetchEnvironments({ organizationId: auth?.currentOrganization?._id });
  const currentEnvironment = environments?.find((env) => !env._parentId);

  if (!currentEnvironment || !user) {
    return null;
  }

  const configuration: InboxProps = {
    applicationIdentifier: currentEnvironment?.identifier,
    subscriberId: user?.externalId as string,
    backendUrl: API_HOSTNAME ?? 'https://api.novu.co',
    socketUrl: WEBSOCKET_HOSTNAME ?? 'https://ws.novu.co',
    localization: {
      'notifications.emptyNotice': 'Click Send Notification to see your first notification',
    },
    appearance: {
      variables: {},
      elements: {
        inboxHeader: {
          backgroundColor: 'white',
        },
        preferencesHeader: {
          backgroundColor: 'white',
        },
        tabsList: {
          backgroundColor: 'white',
        },
        inboxContent: {
          maxHeight: '460px',
        },
      },
    },
    tabs: defaultTabs,
  };

  return (
    <div className="hide-inbox-footer nv-no-scrollbar mt-1 h-[470px] w-[375px] overflow-y-auto overflow-x-hidden">
      <Inbox
        {...configuration}
        routerPush={(path: string) => {
          return navigate(path);
        }}
      >
        <InboxContent />
      </Inbox>
    </div>
  );
}
