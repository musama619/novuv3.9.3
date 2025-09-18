import { UserSession } from '@novu/testing';
import { expect } from 'chai';

describe('Get Signed Url - /storage/upload-url (GET) #novu-v0', () => {
  let session: UserSession;

  beforeEach(async () => {
    session = new UserSession();
    await session.initialize();
  });

  it('should return an S3 signed URL', async () => {
    const {
      body: { data },
    } = await session.testAgent.get('/v1/storage/upload-url?extension=jpg');

    expect(data.path).to.contain('.jpg');
    expect(data.signedUrl).to.contain('.jpg');
    expect(data.signedUrl).to.contain(`${session.organization._id}/${session.environment._id}`);
  });
});
