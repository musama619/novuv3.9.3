import { DirectionEnum, ResourceOriginEnum, ResourceTypeEnum } from '@novu/shared';
import { ClientSession, FilterQuery, ProjectionType, QueryOptions } from 'mongoose';
import { SoftDeleteModel } from 'mongoose-delete';
import { DalException } from '../../shared';
import { EnforceEnvOrOrgIds } from '../../types/enforce';
import { BaseRepository } from '../base-repository';
import { LayoutDBModel, LayoutEntity } from './layout.entity';
import { Layout } from './layout.schema';
import { EnvironmentId, LayoutId, OrderDirectionEnum, OrganizationId } from './types';

type LayoutQuery = FilterQuery<LayoutDBModel> & EnforceEnvOrOrgIds;

export class LayoutRepository extends BaseRepository<LayoutDBModel, LayoutEntity, EnforceEnvOrOrgIds> {
  private layout: SoftDeleteModel;

  constructor() {
    super(Layout, LayoutEntity);
    this.layout = Layout;
  }

  async findOne(
    query: FilterQuery<LayoutDBModel> & EnforceEnvOrOrgIds,
    select?: ProjectionType<LayoutEntity>,
    options: {
      readPreference?: 'secondaryPreferred' | 'primary';
      query?: QueryOptions<LayoutDBModel>;
      session?: ClientSession | null;
    } = {}
  ): Promise<LayoutEntity | null> {
    const { session, ...queryOptions } = options;

    const queryBuilder = this.MongooseModel.findOne(query, select, queryOptions.query)
      .read(queryOptions.readPreference || 'primary')
      .populate('updatedBy');

    if (session) {
      queryBuilder.session(session);
    }

    const data = await queryBuilder;
    if (!data) return null;

    return this.mapEntity(data.toObject());
  }

  async findPublishable(environmentId: string, organizationId: string): Promise<LayoutEntity[]> {
    const items = await this.MongooseModel.find({
      _environmentId: environmentId,
      _organizationId: organizationId,
      type: ResourceTypeEnum.BRIDGE,
      origin: ResourceOriginEnum.NOVU_CLOUD,
    }).populate('updatedBy', '_id firstName lastName externalId');

    return this.mapEntities(items);
  }

  async createLayout(entity: Omit<LayoutEntity, '_id' | 'createdAt' | 'updatedAt'>): Promise<LayoutEntity> {
    const {
      channel,
      content,
      contentType,
      identifier,
      description,
      isDefault,
      name,
      variables,
      _creatorId,
      _environmentId,
      _organizationId,
      type,
      origin,
      controls,
    } = entity;

    return await this.create({
      _creatorId,
      _environmentId,
      _organizationId,
      content,
      contentType,
      identifier,
      isDefault,
      deleted: false,
      description,
      name,
      variables,
      channel,
      type,
      origin,
      controls,
    });
  }

  async deleteLayout(_id: LayoutId, _environmentId: EnvironmentId, _organizationId: OrganizationId): Promise<void> {
    const deleteQuery: LayoutQuery = {
      _id,
      _environmentId,
      _organizationId,
    };

    const result = await this.layout.delete(deleteQuery);

    if (result.modifiedCount !== 1) {
      throw new DalException(
        `Soft delete of layout ${_id} in environment ${_environmentId} was not performed properly`
      );
    }
  }

  async findDefault(_environmentId: EnvironmentId, _organizationId: OrganizationId): Promise<LayoutEntity | null> {
    return await this.findOne({ _environmentId, _organizationId, isDefault: true });
  }

  async findDeleted(id: LayoutId, environmentId: EnvironmentId): Promise<LayoutEntity | null> {
    const deletedLayout: LayoutEntity = await this.layout.findOneDeleted({
      _id: this.convertStringToObjectId(id),
      _environmentId: this.convertStringToObjectId(environmentId),
    });

    if (!deletedLayout?._id) {
      return null;
    }

    return this.mapEntity(deletedLayout);
  }

  async findDeletedByParentId(parentId: LayoutId, environmentId: EnvironmentId): Promise<LayoutEntity | null> {
    const deletedLayout: LayoutEntity = await this.layout.findOneDeleted({
      _parentId: this.convertStringToObjectId(parentId),
      _environmentId: this.convertStringToObjectId(environmentId),
    });

    if (!deletedLayout?._id) {
      return null;
    }

    return this.mapEntity(deletedLayout);
  }

  async filterLayouts(
    query: LayoutQuery,
    pagination: { limit: number; skip: number; sortBy?: string; orderBy?: OrderDirectionEnum }
  ): Promise<LayoutEntity[]> {
    const order = pagination.orderBy ?? OrderDirectionEnum.DESC;
    const sort = pagination.sortBy ? { [pagination.sortBy]: order } : { createdAt: OrderDirectionEnum.DESC };
    const parsedQuery = { ...query };

    parsedQuery._environmentId = this.convertStringToObjectId(parsedQuery._environmentId);
    parsedQuery._organizationId = this.convertStringToObjectId(parsedQuery._organizationId);

    const data = await this.aggregate([
      {
        $match: {
          ...parsedQuery,
        },
      },
      { $sort: sort },
      {
        $skip: pagination.skip,
      },
      {
        $limit: pagination.limit,
      },
    ]);

    return data;
  }

  async updateIsDefault(
    _id: LayoutId,
    _environmentId: EnvironmentId,
    _organizationId: OrganizationId,
    isDefault: boolean
  ): Promise<void> {
    const updated = await this.update(
      {
        _id,
        _environmentId,
        _organizationId,
      },
      {
        isDefault,
      }
    );

    if (updated.matched === 0 || updated.modified === 0) {
      throw new DalException(
        `Update of layout ${_id} in environment ${_environmentId} was not performed properly. Not able to set 'isDefault' to ${isDefault}`
      );
    }
  }

  async updateLayout(entity: LayoutEntity): Promise<LayoutEntity> {
    const { _id, _environmentId, _organizationId, createdAt, updatedAt, ...updates } = entity;

    const updated = await this.update(
      {
        _id,
        _environmentId,
        _organizationId,
      },
      updates
    );

    if (updated.matched === 0 || updated.modified === 0) {
      throw new DalException(`Update of layout ${_id} in environment ${_environmentId} was not performed properly`);
    }

    const updatedEntity = await this.findOne({ _id, _environmentId, _organizationId });

    if (!updatedEntity) {
      throw new DalException(
        `Update of layout ${_id} in environment ${_environmentId} was performed but entity could not been retrieved`
      );
    }

    return updatedEntity;
  }

  public async getV2List({
    organizationId,
    environmentId,
    skip = 0,
    limit = 10,
    searchQuery,
    orderBy = 'createdAt',
    orderDirection = DirectionEnum.DESC,
  }: {
    organizationId: string;
    environmentId: string;
    skip: number;
    limit: number;
    searchQuery?: string;
    orderBy: string;
    orderDirection: DirectionEnum;
  }) {
    const dbQuery: LayoutQuery = {
      _environmentId: environmentId,
      _organizationId: organizationId,
      type: ResourceTypeEnum.BRIDGE,
      origin: ResourceOriginEnum.NOVU_CLOUD,
    };

    if (searchQuery) {
      dbQuery.$or = [
        { name: { $regex: this.regExpEscape(searchQuery), $options: 'i' } },
        { identifier: { $regex: this.regExpEscape(searchQuery), $options: 'i' } },
      ];
    }

    const [layouts, totalCount] = await Promise.all([
      this.paginate(dbQuery, {
        limit,
        skip,
        orderBy,
        orderDirection,
      }),
      this.count(dbQuery),
    ]);

    return {
      data: layouts,
      totalCount,
    };
  }

  private async paginate(
    query: LayoutQuery,
    pagination: { limit: number; skip: number; orderBy: string; orderDirection: DirectionEnum }
  ) {
    const items = await this.MongooseModel.find({
      ...query,
    })
      .sort({ [pagination.orderBy]: pagination.orderDirection === DirectionEnum.ASC ? 1 : -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();

    return this.mapEntities(items);
  }
}
