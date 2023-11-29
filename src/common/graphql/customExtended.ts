import { BadRequestException } from '@nestjs/common';
import { isEmpty } from 'lodash';
import { processWhere } from './utils/processWhere';
import {
  FindManyOptions,
  FindOneOptions,
  FindOptionsOrder,
  FindOptionsSelect,
} from 'typeorm';
import { Repository } from 'typeorm/repository/Repository';
import { isObject } from 'src/util/isObject';
import {
  checkObject,
  directionObj,
  IDriection,
  IGetData,
  ISort,
  OneRepoQuery,
  RepoQuery,
  valueObj,
} from './types';
import { getConditionFromGqlQuery } from './utils/getConditionFromGqlQuery';

export function filterOrder<T>(order: FindOptionsOrder<T>) {
  Object.entries(order).forEach(([key, value]: [string, ISort]) => {
    if (!(key in this.metadata.propertiesMap)) {
      throw new BadRequestException(
        `Order key ${key} is not in ${this.metadata.name}`,
      );
    }

    if (isObject(value)) {
      Object.entries(value).forEach(([_key, _value]) => {
        if (!directionObj[_key]) {
          throw new BadRequestException(
            `Order must be ${Object.keys(directionObj).join(' or ')}`,
          );
        }
        if (!checkObject[_key].includes(_value as unknown)) {
          throw new BadRequestException(
            `Order ${_key} must be ${checkObject[_key].join(' or ')}`,
          );
        }
      });
    } else {
      if (!valueObj[value as IDriection]) {
        throw new BadRequestException(
          `Order must be ${Object.keys(valueObj).join(' or ')}`,
        );
      }
    }
  });
}

export class ExtendedRepository<T = unknown> extends Repository<T> {
  async getMany<T>(
    this: Repository<T>,
    { pagination, where, order, dataType = 'all', relations }: RepoQuery<T>,
    gqlQuery?: string,
  ): Promise<IGetData<T>> {
    // You can remark these lines(if order {}) if you don't want to use strict order roles
    if (order) {
      filterOrder.call(this, order);
    }

    let select: FindOptionsSelect<T> = undefined;
    // In case graphQL query exist
    if (gqlQuery) {
      relations = getConditionFromGqlQuery<T>(gqlQuery, true).relations;
      select = getConditionFromGqlQuery<T>(gqlQuery, true).select;
    }

    const condition: FindManyOptions<T> = {
      relations,
      ...(select && { select }),
      ...(where && !isEmpty(where) && { where: processWhere(where) }),
      ...(order && { order }),
      ...(pagination && {
        skip: pagination.page * pagination.size,
        take: pagination.size,
      }),
    };

    const returns = {
      data: async () => ({ data: await this.find(condition) }),
      count: async () => ({ count: await this.count(condition) }),
      all: async () => {
        const res = await this.findAndCount(condition);
        return { data: res[0], count: res[1] };
      },
    };

    return await returns[dataType]();
  }

  async getOne<T>(
    this: Repository<T>,
    { where, relations }: OneRepoQuery<T>,
    gqlQuery?: string,
  ): Promise<T> {
    let select: FindOptionsSelect<T> = undefined;

    // In case graphQL query exist
    if (gqlQuery) {
      relations = getConditionFromGqlQuery<T>(gqlQuery).relations;
      select = getConditionFromGqlQuery<T>(gqlQuery).select;
    }

    const condition: FindOneOptions<T> = {
      relations,
      ...(select && { select }),
      ...(where && { where: processWhere(where) }),
    };

    return await this.findOne(condition);
  }
}
