import { UserSession } from '@novu/testing';
import { expect } from 'chai';

describe('Create Notification Group - /notification-groups (POST) #novu-v0', async () => {
  let session: UserSession;

  before(async () => {
    session = new UserSession();
    await session.initialize();
  });

  it('should create notification group', async () => {
    const testTemplate = {
      name: 'Test name',
    };

    const { body } = await session.testAgent.post(`/v1/notification-groups`).send(testTemplate);

    expect(body.data).to.be.ok;
    const group = body.data;

    expect(group.name).to.equal(`Test name`);
    expect(group._environmentId).to.equal(session.environment._id);
  });
});
