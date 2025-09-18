import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  decryptCredentials,
  GetNovuProviderCredentials,
  GetNovuProviderCredentialsCommand,
} from '@novu/application-generic';
import {
  ChannelTypeEnum,
  EnvironmentRepository,
  ICredentialsEntity,
  IntegrationEntity,
  IntegrationRepository,
} from '@novu/dal';
import { ChatProviderIdEnum } from '@novu/shared';
import axios from 'axios';
import { CreateChannelEndpointCommand } from '../../../../channel-endpoints/usecases/create-channel-endpoint/create-channel-endpoint.command';
import { CreateChannelEndpoint } from '../../../../channel-endpoints/usecases/create-channel-endpoint/create-channel-endpoint.usecase';
import {
  GenerateSlackOauthUrl,
  StateData,
} from '../../generate-chat-oath-url/generate-slack-oath-url/generate-slack-oauth-url.usecase';
import { ChatOauthCallbackResult, ResponseTypeEnum } from '../chat-oauth-callback.response';
import { SlackOauthCallbackCommand } from './slack-oauth-callback.command';

@Injectable()
export class SlackOauthCallback {
  private readonly SLACK_ACCESS_URL = 'https://slack.com/api/oauth.v2.access';
  private readonly SCRIPT_CLOSE_TAB = '<script>window.close();</script>';

  constructor(
    private integrationRepository: IntegrationRepository,
    private environmentRepository: EnvironmentRepository,
    private createChannelEndpoint: CreateChannelEndpoint,
    private getNovuProviderCredentials: GetNovuProviderCredentials
  ) {}

  async execute(command: SlackOauthCallbackCommand): Promise<ChatOauthCallbackResult> {
    const stateData = await this.decodeSlackState(command.state);
    const integration = await this.getIntegration(stateData);
    const credentials = await this.getIntegrationCredentials(integration);

    const token = await this.exchangeCodeForToken(command.providerCode, credentials);

    await this.createChannelEndpoint.execute(
      CreateChannelEndpointCommand.create({
        organizationId: stateData.organizationId,
        environmentId: stateData.environmentId,
        integrationIdentifier: integration.identifier,
        subscriberId: stateData.subscriberId,
        endpoint: token,
      })
    );

    return {
      type: ResponseTypeEnum.HTML,
      result: this.SCRIPT_CLOSE_TAB,
    };
  }

  private async getIntegration(stateData: StateData): Promise<IntegrationEntity> {
    const integration = await this.integrationRepository.findOne({
      _environmentId: stateData.environmentId,
      _organizationId: stateData.organizationId,
      channel: ChannelTypeEnum.CHAT,
      providerId: { $in: [ChatProviderIdEnum.Slack, ChatProviderIdEnum.Novu] },
      identifier: stateData.integrationIdentifier,
    });

    if (!integration) {
      throw new NotFoundException(
        `Slack integration not found: ${stateData.integrationIdentifier} in environment ${stateData.environmentId}`
      );
    }

    return integration;
  }

  private async getIntegrationCredentials(integration: IntegrationEntity): Promise<ICredentialsEntity> {
    if (integration.providerId === ChatProviderIdEnum.Novu) {
      return this.getDemoNovuSlackCredentials(integration);
    }

    if (!integration.credentials) {
      throw new NotFoundException(`Slack integration missing credentials `);
    }

    if (!integration.credentials.clientId || !integration.credentials.secretKey) {
      throw new NotFoundException(`Slack integration missing required OAuth credentials (clientId/clientSecret) `);
    }

    return integration.credentials;
  }

  private async getDemoNovuSlackCredentials(integration: IntegrationEntity): Promise<ICredentialsEntity> {
    return await this.getNovuProviderCredentials.execute(
      GetNovuProviderCredentialsCommand.create({
        channelType: integration.channel,
        providerId: integration.providerId,
        environmentId: integration._environmentId,
        organizationId: integration._organizationId,
        userId: 'system',
      })
    );
  }

  private async exchangeCodeForToken(
    providerCode: string,
    integrationCredentials: ICredentialsEntity
  ): Promise<string> {
    const credentials = decryptCredentials(integrationCredentials);

    const body = {
      redirect_uri: GenerateSlackOauthUrl.buildRedirectUri(),
      code: providerCode,
      client_id: credentials.clientId,
      client_secret: credentials.secretKey,
    };

    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const res = await axios.post(this.SLACK_ACCESS_URL, body, config);

    if (res?.data?.ok === false) {
      const metaData = res?.data?.response_metadata?.messages?.join(', ');

      throw new BadRequestException(`Slack OAuth error: ${res.data.error}${metaData ? `, metadata: ${metaData}` : ''}`);
    }

    if (!res.data?.access_token) {
      throw new BadRequestException('Slack did not return an access token');
    }

    return res.data.access_token;
  }

  private async decodeSlackState(state: string): Promise<StateData> {
    try {
      const decoded = Buffer.from(state, 'base64url').toString();
      const [payload] = decoded.split('.');
      const preliminaryData = JSON.parse(payload);

      if (!preliminaryData.environmentId) {
        throw new BadRequestException('Invalid Slack state: missing environmentId');
      }

      const environment = await this.environmentRepository.findOne({
        _id: preliminaryData.environmentId,
        _organizationId: preliminaryData.organizationId,
      });

      if (!environment) {
        throw new NotFoundException(`Environment not found: ${preliminaryData.environmentId}`);
      }

      if (!environment.apiKeys?.length) {
        throw new NotFoundException(`Environment ${preliminaryData.environmentId} has no API keys`);
      }

      const environmentApiKey = environment.apiKeys[0].key;

      return await GenerateSlackOauthUrl.validateAndDecodeState(state, environmentApiKey);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Invalid or expired Slack OAuth state parameter');
    }
  }
}
