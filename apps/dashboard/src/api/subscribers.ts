import {
  CreateSubscriberRequestDto,
  GetSubscriberPreferencesDto,
  PatchSubscriberPreferencesDto,
  PatchSubscriberRequestDto,
  RemoveSubscriberResponseDto,
  SubscriberResponseDto,
} from '@novu/api/models/components';
import type { DirectionEnum, IEnvironment, ISubscriberResponseDto } from '@novu/shared';
import { delV2, getV2, patchV2, postV2 } from './api.client';
import { ListTopicSubscriptionsResponse } from './topics';

export type ListSubscribersResponse = {
  data: Array<ISubscriberResponseDto>;
  next: string | null;
  previous: string | null;
};

export const getSubscribers = async ({
  environment,
  after,
  before,
  limit,
  email,
  orderDirection,
  orderBy,
  phone,
  subscriberId,
  name,
  includeCursor,
}: {
  environment: IEnvironment;
  after?: string;
  before?: string;
  limit: number;
  email?: string;
  phone?: string;
  subscriberId?: string;
  name?: string;
  orderDirection?: DirectionEnum;
  orderBy?: string;
  includeCursor?: boolean;
}): Promise<ListSubscribersResponse> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    ...(after && { after }),
    ...(before && { before }),
    ...(orderDirection && { orderDirection }),
    ...(email && { email }),
    ...(phone && { phone }),
    ...(subscriberId && { subscriberId }),
    ...(name && { name }),
    ...(orderBy && { orderBy }),
    ...(orderDirection && { orderDirection }),
    ...(includeCursor && { includeCursor: includeCursor.toString() }),
  });
  const response = await getV2<ListSubscribersResponse>(`/subscribers?${params}`, {
    environment,
  });

  return response;
};

export const deleteSubscriber = async ({
  environment,
  subscriberId,
}: {
  environment: IEnvironment;
  subscriberId: string;
}) => {
  const response = await delV2<RemoveSubscriberResponseDto>(`/subscribers/${subscriberId}`, {
    environment,
  });
  return response;
};

export const getSubscriber = async ({
  environment,
  subscriberId,
}: {
  environment: IEnvironment;
  subscriberId: string;
}) => {
  const { data } = await getV2<{ data: SubscriberResponseDto }>(`/subscribers/${subscriberId}`, {
    environment,
  });

  return data;
};

export const patchSubscriber = async ({
  environment,
  subscriberId,
  subscriber,
}: {
  environment: IEnvironment;
  subscriberId: string;
  subscriber: Partial<PatchSubscriberRequestDto>;
}) => {
  const { data } = await patchV2<{ data: SubscriberResponseDto }>(`/subscribers/${subscriberId}`, {
    environment,
    body: subscriber,
  });

  return data;
};

export const getSubscriberPreferences = async ({
  environment,
  subscriberId,
}: {
  environment: IEnvironment;
  subscriberId: string;
}) => {
  const { data } = await getV2<{ data: GetSubscriberPreferencesDto }>(`/subscribers/${subscriberId}/preferences`, {
    environment,
  });

  return data;
};

export const patchSubscriberPreferences = async ({
  environment,
  subscriberId,
  preferences,
}: {
  environment: IEnvironment;
  subscriberId: string;
  preferences: Partial<PatchSubscriberPreferencesDto>;
}) => {
  const { data } = await patchV2<{ data: GetSubscriberPreferencesDto }>(`/subscribers/${subscriberId}/preferences`, {
    environment,
    body: preferences,
  });

  return data;
};

export const createSubscriber = async ({
  environment,
  subscriber,
}: {
  environment: IEnvironment;
  subscriber: Partial<CreateSubscriberRequestDto>;
}) => {
  const queryParams = new URLSearchParams();
  queryParams.append('failIfExists', 'true');

  const { data } = await postV2<{ data: SubscriberResponseDto }>(`/subscribers?${queryParams}`, {
    environment,
    body: subscriber,
  });

  return data;
};

export const getSubscriberSubscriptions = async ({
  environment,
  subscriberId,
  limit = 10,
  after,
  before,
  orderDirection,
  orderBy,
  key,
  includeCursor,
}: {
  environment: IEnvironment;
  subscriberId: string;
  limit?: number;
  after?: string;
  before?: string;
  orderDirection?: DirectionEnum;
  orderBy?: string;
  key?: string;
  includeCursor?: boolean;
}) => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    ...(after && { after }),
    ...(before && { before }),
    ...(orderDirection && { orderDirection }),
    ...(orderBy && { orderBy }),
    ...(key && { key }),
    ...(includeCursor && { includeCursor: includeCursor.toString() }),
  });

  const response = await getV2<ListTopicSubscriptionsResponse>(`/subscribers/${subscriberId}/subscriptions?${params}`, {
    environment,
  });

  return response;
};
