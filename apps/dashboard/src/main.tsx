import '@maily-to/core/style.css';
import { PermissionsEnum } from '@novu/shared';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import './index.css';

import { ConfigureWorkflow } from '@/components/workflow-editor/configure-workflow';
import { EditStepConditions } from '@/components/workflow-editor/steps/conditions/edit-step-conditions';
import { ConfigureStep } from '@/components/workflow-editor/steps/configure-step';

import {
  ActivityFeed,
  AnalyticsPage,
  ApiKeysPage,
  CreateLayoutPage,
  CreateWorkflowPage,
  ErrorPage,
  IntegrationsListPage,
  LayoutsPage,
  OrganizationListPage,
  SettingsPage,
  SignInPage,
  SignUpPage,
  TemplateModal,
  TranslationsPage,
  WelcomePage,
  WorkflowsPage,
} from '@/pages';
import { DuplicateWorkflowPage } from '@/pages/duplicate-workflow';
import { EditStepTemplateV2Page } from '@/pages/edit-step-template-v2';
import { SubscribersPage } from '@/pages/subscribers';
import { TranslationSettingsPage } from '@/pages/translation-settings-page';
import { WebhooksPage } from '@/pages/webhooks-page';
import { CreateIntegrationSidebar } from './components/integrations/components/create-integration-sidebar';
import { UpdateIntegrationSidebar } from './components/integrations/components/update-integration-sidebar';
import { ChannelPreferences } from './components/workflow-editor/channel-preferences';
import { IS_ENTERPRISE, IS_SELF_HOSTED } from './config';
import { FeatureFlagsProvider } from './context/feature-flags-provider';
import { CreateSubscriberPage } from './pages/create-subscriber';
import { CreateTopicPage } from './pages/create-topic';
import { DuplicateLayoutPage } from './pages/duplicate-layout-page';
import { EditLayoutPage } from './pages/edit-layout';
import { EditSubscriberPage } from './pages/edit-subscriber-page';
import { EditTopicPage } from './pages/edit-topic';
import { EditTranslationPage } from './pages/edit-translation';
import { EditWorkflowPage } from './pages/edit-workflow';
import { EnvironmentsPage } from './pages/environments';
import { InboxEmbedPage } from './pages/inbox-embed-page';
import { InboxEmbedSuccessPage } from './pages/inbox-embed-success-page';
import { InboxUsecasePage } from './pages/inbox-usecase-page';
import { RedirectToLegacyStudioAuth } from './pages/redirect-to-legacy-studio-auth';
import { TestWorkflowDrawerPage } from './pages/test-workflow-drawer-page';
import { TestWorkflowRouteHandler } from './pages/test-workflow-route-handler';
import { TopicsPage } from './pages/topics';
import { VercelIntegrationPage } from './pages/vercel-integration-page';
import { AuthRoute, CatchAllRoute, DashboardRoute, RootRoute } from './routes';
import { OnboardingParentRoute } from './routes/onboarding';
import { ProtectedRoute } from './routes/protected-route';
import { ROUTES } from './utils/routes';
import { initializeSentry } from './utils/sentry';
import { overrideZodErrorMap } from './utils/validation';

initializeSentry();
overrideZodErrorMap();

const router = createBrowserRouter([
  {
    element: <RootRoute />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <AuthRoute />,
        children: [
          {
            path: `${ROUTES.SIGN_IN}/*`,
            element: <SignInPage />,
          },
          {
            path: `${ROUTES.SIGN_UP}/*`,
            element: <SignUpPage />,
          },
          {
            path: ROUTES.SIGNUP_ORGANIZATION_LIST,
            element: <OrganizationListPage />,
          },
        ],
      },
      {
        path: '/onboarding',
        element: <OnboardingParentRoute />,
        children: [
          {
            path: ROUTES.INBOX_USECASE,
            element: <InboxUsecasePage />,
          },
          {
            path: ROUTES.INBOX_EMBED,
            element: <InboxEmbedPage />,
          },
          {
            path: ROUTES.INBOX_EMBED_SUCCESS,
            element: <InboxEmbedSuccessPage />,
          },
        ],
      },
      {
        path: ROUTES.ROOT,
        element: <DashboardRoute />,
        children: [
          /* Direct routes matching environment-specific paths (e.g., /topics -> /env/:envId/topics) 
             will be automatically redirected by the CatchAllRoute component */
          {
            index: true,
            element: <CatchAllRoute />,
          },
          {
            path: ROUTES.ENV,
            children: [
              {
                path: ROUTES.WELCOME,
                element: <WelcomePage />,
              },
              {
                path: ROUTES.WORKFLOWS,
                element: (
                  <ProtectedRoute permission={PermissionsEnum.WORKFLOW_READ}>
                    <WorkflowsPage />
                  </ProtectedRoute>
                ),
                children: [
                  {
                    path: ROUTES.TEMPLATE_STORE,
                    element: <TemplateModal />,
                  },
                  {
                    path: ROUTES.TEMPLATE_STORE_CREATE_WORKFLOW,
                    element: (
                      <ProtectedRoute permission={PermissionsEnum.WORKFLOW_WRITE} isDrawerRoute>
                        <TemplateModal />
                      </ProtectedRoute>
                    ),
                  },
                  {
                    path: ROUTES.WORKFLOWS_CREATE,
                    element: (
                      <ProtectedRoute permission={PermissionsEnum.WORKFLOW_WRITE} isDrawerRoute>
                        <CreateWorkflowPage />
                      </ProtectedRoute>
                    ),
                  },
                  {
                    path: ROUTES.WORKFLOWS_DUPLICATE,
                    element: (
                      <ProtectedRoute permission={PermissionsEnum.WORKFLOW_WRITE} isDrawerRoute>
                        <DuplicateWorkflowPage />
                      </ProtectedRoute>
                    ),
                  },
                ],
              },
              {
                path: ROUTES.SUBSCRIBERS,
                element: (
                  <ProtectedRoute permission={PermissionsEnum.SUBSCRIBER_READ}>
                    <SubscribersPage />
                  </ProtectedRoute>
                ),
                children: [
                  {
                    path: ROUTES.EDIT_SUBSCRIBER,
                    element: (
                      <ProtectedRoute
                        condition={(has) =>
                          has({ permission: PermissionsEnum.SUBSCRIBER_WRITE }) ||
                          has({ permission: PermissionsEnum.SUBSCRIBER_READ })
                        }
                        isDrawerRoute
                      >
                        <EditSubscriberPage />
                      </ProtectedRoute>
                    ),
                  },
                  {
                    path: ROUTES.CREATE_SUBSCRIBER,
                    element: (
                      <ProtectedRoute permission={PermissionsEnum.SUBSCRIBER_WRITE} isDrawerRoute>
                        <CreateSubscriberPage />
                      </ProtectedRoute>
                    ),
                  },
                ],
              },
              {
                path: ROUTES.TOPICS,
                element: (
                  <ProtectedRoute permission={PermissionsEnum.TOPIC_READ}>
                    <TopicsPage />
                  </ProtectedRoute>
                ),
                children: [
                  {
                    path: ROUTES.TOPICS_CREATE,
                    element: (
                      <ProtectedRoute permission={PermissionsEnum.TOPIC_WRITE} isDrawerRoute>
                        <CreateTopicPage />
                      </ProtectedRoute>
                    ),
                  },
                  {
                    path: ROUTES.TOPICS_EDIT,
                    element: (
                      <ProtectedRoute
                        condition={(has) =>
                          has({ permission: PermissionsEnum.TOPIC_WRITE }) ||
                          has({ permission: PermissionsEnum.TOPIC_READ })
                        }
                        isDrawerRoute
                      >
                        <EditTopicPage />
                      </ProtectedRoute>
                    ),
                  },
                ],
              },
              {
                path: ROUTES.LAYOUTS,
                element: (
                  <ProtectedRoute permission={PermissionsEnum.WORKFLOW_READ}>
                    <LayoutsPage />
                  </ProtectedRoute>
                ),
                children: [
                  {
                    path: ROUTES.LAYOUTS_CREATE,
                    element: (
                      <ProtectedRoute permission={PermissionsEnum.WORKFLOW_WRITE} isDrawerRoute>
                        <CreateLayoutPage />
                      </ProtectedRoute>
                    ),
                  },
                  {
                    path: ROUTES.LAYOUTS_DUPLICATE,
                    element: (
                      <ProtectedRoute permission={PermissionsEnum.WORKFLOW_WRITE} isDrawerRoute>
                        <DuplicateLayoutPage />
                      </ProtectedRoute>
                    ),
                  },
                ],
              },
              {
                path: ROUTES.LAYOUTS_EDIT,
                element: (
                  <ProtectedRoute permission={PermissionsEnum.WORKFLOW_READ}>
                    <EditLayoutPage />
                  </ProtectedRoute>
                ),
              },
              {
                path: ROUTES.TRANSLATIONS,
                element: (
                  <ProtectedRoute permission={PermissionsEnum.WORKFLOW_READ}>
                    <TranslationsPage />
                  </ProtectedRoute>
                ),
                children: [
                  {
                    path: ROUTES.TRANSLATION_SETTINGS,
                    element: (
                      <ProtectedRoute permission={PermissionsEnum.WORKFLOW_READ}>
                        <TranslationSettingsPage />
                      </ProtectedRoute>
                    ),
                  },
                  {
                    path: ROUTES.TRANSLATIONS_EDIT,
                    element: (
                      <ProtectedRoute permission={PermissionsEnum.WORKFLOW_READ}>
                        <EditTranslationPage />
                      </ProtectedRoute>
                    ),
                  },
                ],
              },
              {
                path: ROUTES.API_KEYS,
                element: (
                  <ProtectedRoute permission={PermissionsEnum.API_KEY_READ}>
                    <ApiKeysPage />
                  </ProtectedRoute>
                ),
              },
              {
                path: ROUTES.ENVIRONMENTS,
                element: <EnvironmentsPage />,
              },
              {
                path: ROUTES.ACTIVITY_FEED,
                element: (
                  <ProtectedRoute permission={PermissionsEnum.NOTIFICATION_READ}>
                    <ActivityFeed />
                  </ProtectedRoute>
                ),
              },
              {
                path: ROUTES.ACTIVITY_WORKFLOW_RUNS,
                element: (
                  <ProtectedRoute permission={PermissionsEnum.NOTIFICATION_READ}>
                    <ActivityFeed />
                  </ProtectedRoute>
                ),
              },
              {
                path: ROUTES.ACTIVITY_REQUESTS,
                element: (
                  <ProtectedRoute permission={PermissionsEnum.NOTIFICATION_READ}>
                    <ActivityFeed />
                  </ProtectedRoute>
                ),
              },
              {
                path: ROUTES.ANALYTICS,
                element: (
                  <ProtectedRoute permission={PermissionsEnum.NOTIFICATION_READ}>
                    <AnalyticsPage />
                  </ProtectedRoute>
                ),
              },
              {
                path: ROUTES.EDIT_WORKFLOW,
                element: (
                  <ProtectedRoute permission={PermissionsEnum.WORKFLOW_READ}>
                    <EditWorkflowPage />
                  </ProtectedRoute>
                ),
                children: [
                  {
                    element: <ConfigureWorkflow />,
                    index: true,
                  },
                  {
                    element: <ConfigureStep />,
                    path: ROUTES.EDIT_STEP,
                  },

                  {
                    element: <EditStepTemplateV2Page />,
                    path: ROUTES.EDIT_STEP_TEMPLATE,
                  },
                  {
                    element: <EditStepConditions />,
                    path: ROUTES.EDIT_STEP_CONDITIONS,
                  },
                  {
                    element: <ChannelPreferences />,
                    path: ROUTES.EDIT_WORKFLOW_PREFERENCES,
                  },
                  {
                    path: ROUTES.TRIGGER_WORKFLOW,
                    element: (
                      <ProtectedRoute permission={PermissionsEnum.EVENT_WRITE} isDrawerRoute>
                        <TestWorkflowDrawerPage />
                      </ProtectedRoute>
                    ),
                  },
                ],
              },
              {
                path: ROUTES.EDIT_WORKFLOW_ACTIVITY,
                element: (
                  <ProtectedRoute permission={PermissionsEnum.WORKFLOW_READ}>
                    <EditWorkflowPage />
                  </ProtectedRoute>
                ),
              },
              {
                path: ROUTES.TEST_WORKFLOW,
                element: (
                  <ProtectedRoute permission={PermissionsEnum.EVENT_WRITE}>
                    <TestWorkflowRouteHandler />
                  </ProtectedRoute>
                ),
              },
              {
                path: ROUTES.WEBHOOKS_ENDPOINTS,
                element: (
                  <ProtectedRoute
                    condition={(has) =>
                      has({ permission: PermissionsEnum.WEBHOOK_READ }) ||
                      has({ permission: PermissionsEnum.WEBHOOK_WRITE })
                    }
                  >
                    <WebhooksPage />
                  </ProtectedRoute>
                ),
              },
              {
                path: ROUTES.WEBHOOKS_EVENT_CATALOG,
                element: (
                  <ProtectedRoute
                    condition={(has) =>
                      has({ permission: PermissionsEnum.WEBHOOK_READ }) ||
                      has({ permission: PermissionsEnum.WEBHOOK_WRITE })
                    }
                  >
                    <WebhooksPage />
                  </ProtectedRoute>
                ),
              },
              {
                path: ROUTES.WEBHOOKS_LOGS,
                element: (
                  <ProtectedRoute
                    condition={(has) =>
                      has({ permission: PermissionsEnum.WEBHOOK_READ }) ||
                      has({ permission: PermissionsEnum.WEBHOOK_WRITE })
                    }
                  >
                    <WebhooksPage />
                  </ProtectedRoute>
                ),
              },
              {
                path: ROUTES.WEBHOOKS_ACTIVITY,
                element: (
                  <ProtectedRoute
                    condition={(has) =>
                      has({ permission: PermissionsEnum.WEBHOOK_READ }) ||
                      has({ permission: PermissionsEnum.WEBHOOK_WRITE })
                    }
                  >
                    <WebhooksPage />
                  </ProtectedRoute>
                ),
              },
              {
                path: ROUTES.WEBHOOKS,
                element: (
                  <ProtectedRoute
                    condition={(has) =>
                      has({ permission: PermissionsEnum.WEBHOOK_READ }) ||
                      has({ permission: PermissionsEnum.WEBHOOK_WRITE })
                    }
                  >
                    <Navigate to={ROUTES.WEBHOOKS_ENDPOINTS} replace />
                  </ProtectedRoute>
                ),
              },

              {
                path: '*',
                element: <CatchAllRoute />,
              },
            ],
          },
          {
            path: ROUTES.INTEGRATIONS,
            element: (
              <ProtectedRoute permission={PermissionsEnum.INTEGRATION_READ}>
                <IntegrationsListPage />
              </ProtectedRoute>
            ),
            children: [
              {
                path: ROUTES.INTEGRATIONS_CONNECT,
                element: (
                  <ProtectedRoute permission={PermissionsEnum.INTEGRATION_WRITE} isDrawerRoute>
                    <CreateIntegrationSidebar isOpened />
                  </ProtectedRoute>
                ),
              },
              {
                path: ROUTES.INTEGRATIONS_CONNECT_PROVIDER,
                element: (
                  <ProtectedRoute permission={PermissionsEnum.INTEGRATION_WRITE} isDrawerRoute>
                    <CreateIntegrationSidebar isOpened />
                  </ProtectedRoute>
                ),
              },
              {
                path: ROUTES.INTEGRATIONS_UPDATE,
                element: (
                  <ProtectedRoute
                    condition={(has) =>
                      has({ permission: PermissionsEnum.INTEGRATION_WRITE }) ||
                      has({ permission: PermissionsEnum.INTEGRATION_READ })
                    }
                    isDrawerRoute
                  >
                    <UpdateIntegrationSidebar isOpened />
                  </ProtectedRoute>
                ),
              },
            ],
          },
          {
            path: ROUTES.PARTNER_INTEGRATIONS_VERCEL,
            element: (
              <ProtectedRoute permission={PermissionsEnum.PARTNER_INTEGRATION_READ}>
                <VercelIntegrationPage />
              </ProtectedRoute>
            ),
          },
          {
            path: ROUTES.SETTINGS,
            element: IS_SELF_HOSTED && !IS_ENTERPRISE ? <Navigate to={ROUTES.ROOT} /> : <SettingsPage />,
          },
          {
            path: ROUTES.SETTINGS_ACCOUNT,
            element: IS_SELF_HOSTED && !IS_ENTERPRISE ? <Navigate to={ROUTES.ROOT} /> : <SettingsPage />,
          },
          {
            path: ROUTES.SETTINGS_ORGANIZATION,
            element: IS_SELF_HOSTED && !IS_ENTERPRISE ? <Navigate to={ROUTES.ROOT} /> : <SettingsPage />,
          },
          {
            path: ROUTES.SETTINGS_TEAM,
            element: IS_SELF_HOSTED && !IS_ENTERPRISE ? <Navigate to={ROUTES.ROOT} /> : <SettingsPage />,
          },
          {
            path: ROUTES.SETTINGS_BILLING,
            element: IS_SELF_HOSTED ? <Navigate to={ROUTES.ROOT} /> : <SettingsPage />,
          },
          {
            path: ROUTES.LOCAL_STUDIO_AUTH,
            element: <RedirectToLegacyStudioAuth />,
          },
          {
            path: '*',
            element: <CatchAllRoute />,
          },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeatureFlagsProvider>
      <RouterProvider router={router} />
    </FeatureFlagsProvider>
  </StrictMode>
);
