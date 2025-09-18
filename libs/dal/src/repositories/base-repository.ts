import { DirectionEnum } from '@novu/shared';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import {
  ClientSession,
  FilterQuery,
  Model,
  ProjectionType,
  QueryOptions,
  QueryWithHelpers,
  SortOrder,
  Types,
  UpdateQuery,
} from 'mongoose';
import { DalException } from '../shared';

export class BaseRepository<T_DBModel, T_MappedEntity, T_Enforcement> {
  public _model: Model<T_DBModel>;

  constructor(
    protected MongooseModel: Model<T_DBModel>,
    protected entity: ClassConstructor<T_MappedEntity>
  ) {
    this._model = MongooseModel;
  }

  public static createObjectId() {
    return new Types.ObjectId().toString();
  }

  public static isInternalId(id: string) {
    const isValidMongoId = Types.ObjectId.isValid(id);
    if (!isValidMongoId) {
      return false;
    }

    return id === new Types.ObjectId(id).toString();
  }

  protected convertObjectIdToString(value: Types.ObjectId): string {
    return value.toString();
  }

  protected convertStringToObjectId(value: string): Types.ObjectId {
    return new Types.ObjectId(value);
  }

  async count(query: FilterQuery<T_DBModel> & T_Enforcement, limit?: number): Promise<number> {
    return this.MongooseModel.countDocuments(query, {
      limit,
    });
  }

  async estimatedDocumentCount(): Promise<number> {
    return this.MongooseModel.estimatedDocumentCount();
  }

  async aggregate(query: any[], options: { readPreference?: 'secondaryPreferred' | 'primary' } = {}): Promise<any> {
    return await this.MongooseModel.aggregate(query).read(options.readPreference || 'primary');
  }

  async findOne(
    query: FilterQuery<T_DBModel> & T_Enforcement,
    select?: ProjectionType<T_MappedEntity>,
    options: {
      readPreference?: 'secondaryPreferred' | 'primary';
      query?: QueryOptions<T_DBModel>;
      session?: ClientSession | null;
    } = {}
  ): Promise<T_MappedEntity | null> {
    const { session, ...queryOptions } = options;

    const queryBuilder = this.MongooseModel.findOne(query, select, queryOptions.query).read(
      queryOptions.readPreference || 'primary'
    );

    if (session) {
      queryBuilder.session(session);
    }

    const data = await queryBuilder;
    if (!data) return null;

    return this.mapEntity(data.toObject());
  }

  async findOneAndUpdate(
    query: FilterQuery<T_DBModel> & T_Enforcement,
    update: UpdateQuery<T_DBModel>,
    options: QueryOptions<T_DBModel> & { session?: ClientSession | null } = {}
  ): Promise<T_MappedEntity | null> {
    const { session, ...updateOptions } = options;

    const data = await this.MongooseModel.findOneAndUpdate(query, update, {
      ...updateOptions,
      upsert: updateOptions.upsert || false,
      new: updateOptions.new || false,
      ...(session && { session }),
    });

    if (!data) return null;

    return this.mapEntity(data.toObject());
  }

  async delete(
    query: FilterQuery<T_DBModel> & T_Enforcement,
    options: { session?: ClientSession | null } = {}
  ): Promise<{
    /** Indicates whether this writes result was acknowledged. If not, then all other members of this result will be undefined. */
    acknowledged: boolean;
    /** The number of documents that were deleted */
    deletedCount: number;
  }> {
    const { session } = options;
    const deleteOptions = session ? { session } : {};

    return await this.MongooseModel.deleteMany(query, deleteOptions);
  }

  async findOneAndDelete(query: FilterQuery<T_DBModel> & T_Enforcement): Promise<T_MappedEntity | null> {
    const data = await this.MongooseModel.findOneAndDelete(query).lean();
    if (!data) return null;

    return this.mapEntity(data);
  }

  async find(
    query: FilterQuery<T_DBModel> & T_Enforcement,
    select: ProjectionType<T_MappedEntity> = '',
    options: { limit?: number; sort?: any; skip?: number; session?: ClientSession | null } = {}
  ): Promise<T_MappedEntity[]> {
    const { session, ...queryOptions } = options;

    const queryBuilder = this.MongooseModel.find(query, select, {
      sort: queryOptions.sort || null,
    })
      .skip(queryOptions.skip as number)
      .limit(queryOptions.limit as number)
      .lean();

    if (session) {
      queryBuilder.session(session);
    }

    const data = await queryBuilder.exec();

    return this.mapEntities(data);
  }

  async *findBatch(
    query: FilterQuery<T_DBModel> & T_Enforcement,
    select = '',
    options: { limit?: number; sort?: any; skip?: number } = {},
    batchSize = 500
  ) {
    for await (const doc of this._model
      .find(query, select, {
        sort: options.sort || null,
      })
      .batchSize(batchSize)
      .cursor()) {
      yield this.mapEntity(doc);
    }
  }

  private async createCursorBasedOrStatement({
    isSortDesc,
    paginateField,
    after,
    queryOrStatements,
  }: {
    isSortDesc: boolean;
    paginateField?: string;
    after: string;
    queryOrStatements?: object[];
  }): Promise<FilterQuery<T_DBModel>[]> {
    const afterItem = await this.MongooseModel.findOne({ _id: after });
    if (!afterItem) {
      throw new DalException('Invalid after id');
    }

    let cursorOrStatements: FilterQuery<T_DBModel>[] = [];
    let enhancedCursorOrStatements: FilterQuery<T_DBModel>[] = [];
    if (paginateField && afterItem[paginateField]) {
      const paginatedFieldValue = afterItem[paginateField];
      cursorOrStatements = [
        { [paginateField]: isSortDesc ? { $lt: paginatedFieldValue } : { $gt: paginatedFieldValue } } as any,
        { [paginateField]: { $eq: paginatedFieldValue }, _id: isSortDesc ? { $lt: after } : { $gt: after } },
      ];
      const firstStatement = (queryOrStatements ?? []).map((item) => ({
        ...item,
        ...cursorOrStatements[0],
      }));
      const secondStatement = (queryOrStatements ?? []).map((item) => ({
        ...item,
        ...cursorOrStatements[1],
      }));
      enhancedCursorOrStatements = [...firstStatement, ...secondStatement];
    } else {
      cursorOrStatements = [{ _id: isSortDesc ? { $lt: after } : { $gt: after } }];
      const firstStatement = (queryOrStatements ?? []).map((item) => ({
        ...item,
        ...cursorOrStatements[0],
      }));
      enhancedCursorOrStatements = [...firstStatement];
    }

    return enhancedCursorOrStatements.length > 0 ? enhancedCursorOrStatements : cursorOrStatements;
  }

  /**
   * @deprecated This method is deprecated
   * Please use findWithCursorBasedPagination() instead.
   */
  async cursorPagination({
    query,
    limit,
    offset,
    after,
    sort,
    paginateField,
    enhanceQuery,
  }: {
    query?: FilterQuery<T_DBModel> & T_Enforcement;
    limit: number;
    offset: number;
    after?: string;
    sort?: any;
    paginateField?: string;
    enhanceQuery?: (query: QueryWithHelpers<Array<T_DBModel>, T_DBModel>) => any;
  }): Promise<{ data: T_MappedEntity[]; hasMore: boolean }> {
    const isAfterDefined = typeof after !== 'undefined';
    const sortKeys = Object.keys(sort ?? {});
    const isSortDesc = sortKeys.length > 0 && sort[sortKeys[0]] === -1;

    let findQueryBuilder = this.MongooseModel.find({
      ...query,
    });
    if (isAfterDefined) {
      const orStatements = await this.createCursorBasedOrStatement({
        isSortDesc,
        paginateField,
        after,
        queryOrStatements: query?.$or,
      });

      findQueryBuilder = this.MongooseModel.find({
        ...query,
        $or: orStatements,
      });
    }

    findQueryBuilder.sort(sort).limit(limit + 1);
    if (!isAfterDefined) {
      findQueryBuilder.skip(offset);
    }

    if (enhanceQuery) {
      findQueryBuilder = enhanceQuery(findQueryBuilder);
    }

    const messages = await findQueryBuilder.exec();

    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop();
    }

    return {
      data: this.mapEntities(messages),
      hasMore,
    };
  }

  async create(
    data: FilterQuery<T_DBModel> & T_Enforcement,
    options: IOptions & { session?: ClientSession | null } = {}
  ): Promise<T_MappedEntity> {
    const { session, ...saveOptions } = options;
    const newEntity = new this.MongooseModel(data);

    const mongooseOptions = saveOptions?.writeConcern ? { w: saveOptions?.writeConcern } : {};
    if (session) {
      Object.assign(mongooseOptions, { session });
    }

    const saved = await newEntity.save(mongooseOptions);

    return this.mapEntity(saved);
  }

  async insertMany(
    data: FilterQuery<T_DBModel> & T_Enforcement[],
    ordered = false
  ): Promise<{ acknowledged: boolean; insertedCount: number; insertedIds: Types.ObjectId[] }> {
    let result;
    try {
      result = await this.MongooseModel.insertMany(data, { ordered });
    } catch (e: unknown) {
      if (e instanceof Error) {
        throw new DalException(e.message);
      } else {
        throw new DalException('An unknown error occurred');
      }
    }

    const insertedIds = result.map((inserted) => inserted._id);

    return {
      acknowledged: true,
      insertedCount: result.length,
      insertedIds,
    };
  }

  async update(
    query: FilterQuery<T_DBModel> & T_Enforcement,
    updateBody: UpdateQuery<T_DBModel>,
    options: QueryOptions<T_DBModel> & { session?: ClientSession | null } = {}
  ): Promise<{
    matched: number;
    modified: number;
  }> {
    const { session, ...updateOptions } = options;

    const saved = await this.MongooseModel.updateMany(query, updateBody, {
      multi: true,
      ...updateOptions,
      ...(session && { session }),
    });

    return {
      matched: saved.matchedCount,
      modified: saved.modifiedCount,
    };
  }

  async updateOne(
    query: FilterQuery<T_DBModel> & T_Enforcement,
    updateBody: UpdateQuery<T_DBModel>
  ): Promise<{
    matched: number;
    modified: number;
  }> {
    const saved = await this.MongooseModel.updateOne(query, updateBody);

    return {
      matched: saved.matchedCount,
      modified: saved.modifiedCount,
    };
  }

  async upsertMany(data: (FilterQuery<T_DBModel> & T_Enforcement)[]) {
    const promises = data.map((entry) =>
      this.MongooseModel.findOneAndUpdate(entry, entry, { upsert: true, new: true })
    );

    return await Promise.all(promises);
  }

  async upsert(query: FilterQuery<T_DBModel> & T_Enforcement, data: FilterQuery<T_DBModel> & T_Enforcement) {
    return await this.MongooseModel.findOneAndUpdate(query, data, {
      upsert: true,
      new: true,
      includeResultMetadata: true,
    });
  }

  async bulkWrite(bulkOperations: any, ordered = false): Promise<any> {
    return await this.MongooseModel.bulkWrite(bulkOperations, { ordered });
  }

  protected mapEntity<TData>(data: TData): TData extends null ? null : T_MappedEntity {
    return plainToInstance(this.entity, JSON.parse(JSON.stringify(data))) as any;
  }

  protected mapEntities(data: any): T_MappedEntity[] {
    return plainToInstance<T_MappedEntity, T_MappedEntity[]>(this.entity, JSON.parse(JSON.stringify(data)));
  }

  /*
   * Note about parallelism in transactions
   *
   * Running operations in parallel is not supported during a transaction.
   * The use of Promise.all, Promise.allSettled, Promise.race, etc. to parallelize operations
   * inside a transaction is undefined behaviour and should be avoided.
   *
   * Refer to https://mongoosejs.com/docs/transactions.html#note-about-parallelism-in-transactions
   */
  async withTransaction(fn: (session: ClientSession | null) => Promise<any>) {
    try {
      return await (await this._model.db.startSession()).withTransaction(fn);
    } catch (error) {
      // Check if the error is related to replica set requirement
      if (
        error.message?.includes('replica set') ||
        error.message?.includes('transaction') ||
        error.codeName === 'IllegalOperation'
      ) {
        // MongoDB is not running in replica set mode, execute without transaction
        return await fn(null);
      }

      throw error;
    }
  }

  async findWithCursorBasedPagination({
    query = {} as FilterQuery<T_DBModel> & T_Enforcement,
    limit,
    before,
    after,
    sortBy,
    sortDirection = DirectionEnum.DESC,
    paginateField,
    enhanceQuery,
    includeCursor,
  }: {
    query?: FilterQuery<T_DBModel> & T_Enforcement;
    limit: number;
    before?: { sortBy: string; paginateField: any };
    after?: { sortBy: string; paginateField: any };
    sortBy: string;
    sortDirection: DirectionEnum;
    paginateField: string;
    enhanceQuery?: (query: QueryWithHelpers<Array<T_DBModel>, T_DBModel>) => any;
    includeCursor?: boolean;
  }): Promise<{ data: T_MappedEntity[]; next: string | null; previous: string | null }> {
    if (before && after) {
      throw new DalException('Cannot specify both "before" and "after" cursors at the same time.');
    }

    const isDesc = sortDirection === DirectionEnum.DESC;
    const sortValue = isDesc ? -1 : 1;
    const paginationQuery: any = { ...query };

    let reverseResults = false;

    if (before) {
      paginationQuery.$or = [
        {
          [sortBy]: isDesc
            ? { [includeCursor ? '$gte' : '$gt']: before.sortBy }
            : { [includeCursor ? '$lte' : '$lt']: before.sortBy },
        },
        {
          $and: [
            { [sortBy]: { $eq: before.sortBy } },
            {
              [paginateField]: isDesc
                ? { [includeCursor ? '$gte' : '$gt']: before.paginateField }
                : { [includeCursor ? '$lte' : '$lt']: before.paginateField },
            },
          ],
        },
      ];

      // Reverse sort order for backwards pagination
      reverseResults = true;
    } else if (after) {
      paginationQuery.$or = [
        {
          [sortBy]: isDesc
            ? { [includeCursor ? '$lte' : '$lt']: after.sortBy }
            : { [includeCursor ? '$gte' : '$gt']: after.sortBy },
        },
        {
          $and: [
            { [sortBy]: { $eq: after.sortBy } },
            {
              [paginateField]: isDesc
                ? { [includeCursor ? '$lte' : '$lt']: after.paginateField }
                : { [includeCursor ? '$gte' : '$gt']: after.paginateField },
            },
          ],
        },
      ];
    }

    let builder = this.MongooseModel.find(paginationQuery)
      .sort({
        [sortBy]: reverseResults ? -sortValue : sortValue,
        [paginateField]: reverseResults ? -sortValue : sortValue,
      } as Record<string, SortOrder>)
      .limit(limit + 1);

    if (enhanceQuery) {
      builder = enhanceQuery(builder);
    }

    const rawResults = await builder.exec();
    const hasExtraItem = rawResults.length > limit;

    let startIndex = 0;
    let endIndex = limit;
    if (reverseResults) {
      rawResults.reverse();

      /**
       * If we have an extra item, we need to adjust the start and end index
       * as it is reversed, the first item is actually the extra item
       */
      if (hasExtraItem) {
        startIndex = 1;
        endIndex = limit + 1;
      }
    }

    const pageResults = rawResults.slice(startIndex, endIndex);

    if (pageResults.length === 0) {
      return {
        data: [],
        next: null,
        previous: null,
      };
    }

    let nextCursor: string | null = null;
    let prevCursor: string | null = null;

    const firstItem = pageResults[0];
    const lastItem = pageResults[pageResults.length - 1];

    if (hasExtraItem) {
      if (before) {
        prevCursor = firstItem[paginateField].toString();
      } else {
        nextCursor = lastItem[paginateField].toString();
      }
    }

    if (before) {
      const nextQuery: any = { ...query };

      nextQuery.$or = [
        {
          [sortBy]: isDesc ? { $lt: lastItem[sortBy] } : { $gt: lastItem[sortBy] },
        },
        {
          $and: [
            { [sortBy]: { $eq: lastItem[sortBy] } },
            {
              [paginateField]: isDesc ? { $lt: lastItem[paginateField] } : { $gt: lastItem[paginateField] },
            },
          ],
        },
      ];

      const maybeNext = await this.MongooseModel.findOne(nextQuery)
        .sort({ [sortBy]: sortValue, [paginateField]: sortValue })
        .limit(1)
        .exec();

      if (maybeNext) {
        nextCursor = lastItem[paginateField].toString();
      }
    } else {
      const prevQuery: any = { ...query };

      prevQuery.$or = [
        {
          [sortBy]: isDesc ? { $gt: firstItem[sortBy] } : { $lt: firstItem[sortBy] },
        },
        {
          $and: [
            { [sortBy]: { $eq: firstItem[sortBy] } },
            { [paginateField]: isDesc ? { $gt: firstItem[paginateField] } : { $lt: firstItem[paginateField] } },
          ],
        },
      ];

      const maybePrev = await this.MongooseModel.findOne(prevQuery)
        .sort({ [sortBy]: sortValue, [paginateField]: sortValue })
        .limit(1)
        .exec();

      if (maybePrev) {
        prevCursor = firstItem[paginateField].toString();
      }
    }

    return {
      data: this.mapEntities(pageResults),
      next: nextCursor,
      previous: prevCursor,
    };
  }

  protected regExpEscape(literalString: string): string {
    return literalString.replace(/[-[\]{}()*+!<=:?./\\^$|#\s,]/g, '\\$&');
  }
}

interface IOptions {
  writeConcern?: number | 'majority';
}
