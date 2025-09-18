import { Novu } from '@novu/api';
import { JobRepository, JobStatusEnum, MessageRepository, SubscriberEntity } from '@novu/dal';
import { DelayTypeEnum, DigestTypeEnum, DigestUnitEnum, JobTopicNameEnum, StepTypeEnum } from '@novu/shared';
import { SubscribersService, UserSession } from '@novu/testing';
import { expect } from 'chai';
import { addSeconds } from 'date-fns';
import { initNovuClassSdk } from '../../shared/helpers/e2e/sdk/e2e-sdk.helper';
import { pollForJobStatusChange } from './utils/poll-for-job-status-change.util';

describe('Trigger event - Delay triggered events - /v1/events/trigger (POST) #novu-v2', () => {
  let session: UserSession;
  let subscriber: SubscriberEntity;
  let subscriberService: SubscribersService;
  let novuClient: Novu;
  const jobRepository = new JobRepository();
  const messageRepository = new MessageRepository();

  beforeEach(async () => {
    session = new UserSession();
    await session.initialize();
    subscriberService = new SubscribersService(session.organization._id, session.environment._id);
    subscriber = await subscriberService.createSubscriber();
    novuClient = initNovuClassSdk(session);
  });

  it('should delay execution for the provided interval', async () => {
    const template = await session.createTemplate({
      steps: [
        {
          type: StepTypeEnum.IN_APP,
          content: 'Not Delayed {{customVar}}' as string,
        },
        {
          type: StepTypeEnum.DELAY,
          content: '',
          metadata: {
            unit: DigestUnitEnum.SECONDS,
            amount: 1,
            type: DelayTypeEnum.REGULAR,
          },
        },
        {
          type: StepTypeEnum.IN_APP,
          content: 'Hello world {{customVar}}' as string,
        },
      ],
    });

    await novuClient.trigger({
      workflowId: template.triggers[0].identifier,
      to: [subscriber.subscriberId],
      payload: {
        customVar: 'Testing of User Name',
      },
    });

    await session.waitForWorkflowQueueCompletion();
    await session.waitForSubscriberQueueCompletion();

    const delayedJob = await pollForJobStatusChange({
      jobRepository,
      query: {
        _environmentId: session.environment._id,
        _templateId: template._id,
        type: StepTypeEnum.DELAY,
      },
      timeout: 5000,
    });

    expect(delayedJob!.status).to.equal(JobStatusEnum.DELAYED);

    const messages = await messageRepository.find({
      _environmentId: session.environment._id,
      _subscriberId: subscriber._id,
      channel: StepTypeEnum.IN_APP,
    });

    expect(messages.length).to.equal(1);
    expect(messages[0].content).to.include('Not Delayed');

    await session.waitForJobCompletion(template?._id);

    const messagesAfter = await messageRepository.find({
      _environmentId: session.environment._id,
      _subscriberId: subscriber._id,
      channel: StepTypeEnum.IN_APP,
    });

    expect(messagesAfter.length).to.equal(2);
  });

  it('should delay execution until the provided datetime', async () => {
    const template = await session.createTemplate({
      steps: [
        {
          type: StepTypeEnum.DELAY,
          content: '',
          metadata: {
            type: DelayTypeEnum.SCHEDULED,
            delayPath: 'sendAt',
          },
        },
        {
          type: StepTypeEnum.SMS,
          content: 'Hello world {{customVar}}' as string,
        },
      ],
    });

    await novuClient.trigger({
      workflowId: template.triggers[0].identifier,
      to: [subscriber.subscriberId],
      payload: {
        customVar: 'Testing of User Name',
        sendAt: addSeconds(new Date(), 30),
      },
    });

    await session.waitForWorkflowQueueCompletion();
    await session.waitForSubscriberQueueCompletion();

    const delayedJobs = await jobRepository.find({
      _environmentId: session.environment._id,
      _templateId: template._id,
      type: StepTypeEnum.DELAY,
    });

    expect(delayedJobs.length).to.eql(1);
  });

  it('should not include delayed event in digested sent message', async () => {
    const template = await session.createTemplate({
      steps: [
        {
          type: StepTypeEnum.DELAY,
          content: '',
          metadata: {
            unit: DigestUnitEnum.SECONDS,
            amount: 0.1,
            type: DelayTypeEnum.REGULAR,
          },
        },
        {
          type: StepTypeEnum.DIGEST,
          content: '',
          metadata: {
            unit: DigestUnitEnum.SECONDS,
            amount: 1,
            type: DigestTypeEnum.REGULAR,
          },
        },
        {
          type: StepTypeEnum.SMS,
          content: 'Event {{eventNumber}}. Digested Events {{step.events.length}}' as string,
        },
      ],
    });

    await novuClient.trigger({
      workflowId: template.triggers[0].identifier,
      to: [subscriber.subscriberId],
      payload: {
        eventNumber: '1',
      },
    });

    await novuClient.trigger({
      workflowId: template.triggers[0].identifier,
      to: [subscriber.subscriberId],
      payload: {
        eventNumber: '2',
      },
    });

    await session.waitForJobCompletion(template?._id);

    const messages = await messageRepository.find({
      _environmentId: session.environment._id,
      _subscriberId: subscriber._id,
      channel: StepTypeEnum.SMS,
    });

    expect(messages[0].content).to.include('Event ');
    expect(messages[0].content).to.include('Digested Events 2');
  });

  it('should send a single message for same exact scheduled delay', async () => {
    const template = await session.createTemplate({
      steps: [
        {
          type: StepTypeEnum.DELAY,
          content: '',
          metadata: {
            type: DelayTypeEnum.SCHEDULED,
            delayPath: 'sendAt',
          },
        },
        {
          type: StepTypeEnum.DIGEST,
          content: '',
          metadata: {
            unit: DigestUnitEnum.SECONDS,
            amount: 1,
            type: DigestTypeEnum.REGULAR,
          },
        },
        {
          type: StepTypeEnum.SMS,
          content: 'Digested Events {{step.events.length}}' as string,
        },
      ],
    });

    const dateValue = addSeconds(new Date(), 1);

    await novuClient.trigger({
      workflowId: template.triggers[0].identifier,
      to: [subscriber.subscriberId],
      payload: {
        eventNumber: '1',
        sendAt: dateValue,
      },
    });

    await novuClient.trigger({
      workflowId: template.triggers[0].identifier,
      to: [subscriber.subscriberId],
      payload: {
        eventNumber: '2',
        sendAt: dateValue,
      },
    });

    await session.waitForJobCompletion(template?._id);

    const messages = await messageRepository.find({
      _environmentId: session.environment._id,
      _subscriberId: subscriber._id,
      channel: StepTypeEnum.SMS,
    });

    expect(messages.length).to.equal(1);
    expect(messages[0].content).to.include('Digested Events 2');
  });

  // TODO: Restore the test when the internal SDK is updated
  it.skip('should fail for missing or invalid path for scheduled delay', async () => {
    const template = await session.createTemplate({
      steps: [
        {
          type: StepTypeEnum.DELAY,
          content: '',
          metadata: {
            type: DelayTypeEnum.SCHEDULED,
            delayPath: 'sendAt',
          },
        },
        {
          type: StepTypeEnum.SMS,
          content: 'Hello world {{customVar}}' as string,
        },
      ],
    });

    const { result: result1 } = await novuClient.trigger({
      workflowId: template.triggers[0].identifier,
      to: [subscriber.subscriberId],
      payload: {
        customVar: 'Testing of User Name',
      },
    });

    expect(result1.error?.[0]).to.equal('payload is missing required key(s) and type(s): sendAt (ISO Date)');

    const { result: result2 } = await novuClient.trigger({
      workflowId: template.triggers[0].identifier,
      to: [subscriber.subscriberId],
      payload: {
        customVar: 'Testing of User Name',
        sendAt: '20-09-2025',
      },
    });

    expect(result2.error?.[0]).to.equal('payload is missing required key(s) and type(s): sendAt (ISO Date)');
  });
});
