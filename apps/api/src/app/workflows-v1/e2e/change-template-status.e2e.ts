import { NotificationTemplateRepository } from '@novu/dal';
import { NotificationTemplateService, UserSession } from '@novu/testing';
import { expect } from 'chai';

describe('Change workflow status by id - /workflows/:workflowId/status (PUT) #novu-v0', async () => {
  let session: UserSession;
  const notificationTemplateRepository = new NotificationTemplateRepository();

  before(async () => {
    session = new UserSession();
    await session.initialize();
  });

  it('should change the status from active false to active true', async () => {
    const notificationTemplateService = new NotificationTemplateService(
      session.user._id,
      session.organization._id,
      session.environment._id
    );
    const template = await notificationTemplateService.createTemplate({
      active: false,
      draft: true,
    });
    const beforeChange = await notificationTemplateRepository.findById(template._id, template._environmentId);

    expect(beforeChange?.active).to.equal(false);
    expect(beforeChange?.draft).to.equal(true);
    const { body } = await session.testAgent.put(`/v1/workflows/${template._id}/status`).send({
      active: true,
    });
    const found = await notificationTemplateRepository.findById(template._id, template._environmentId);

    expect(found?.active).to.equal(true);
    expect(found?.draft).to.equal(false);
  });
});
