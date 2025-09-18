import { SubscriberEntity } from '@novu/dal';
import { ISubscriberChannel, SubscriberCustomData } from '@novu/shared';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsLocale, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { EnvironmentCommand } from '../../commands';

export class CreateOrUpdateSubscriberCommand extends EnvironmentCommand {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.toString().trim())
  subscriberId: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsLocale()
  @IsOptional()
  locale?: string;

  @IsOptional()
  data?: SubscriberCustomData;

  @IsOptional()
  timezone?: string | null;

  /**
   * Represents existing entity that will be used for updating subscriber instead of creating one
   * @optional
   */
  @IsOptional()
  subscriber?: SubscriberEntity;

  @IsOptional()
  channels?: ISubscriberChannel[];
  /**
   * Represents the name of the active worker that is processing the subscriber for debugging and logging
   */
  @IsOptional()
  activeWorkerName?: string;

  @IsOptional()
  @IsBoolean()
  allowUpdate?: boolean = true;

  @IsOptional()
  @IsBoolean()
  failIfExists?: boolean = false;
}
