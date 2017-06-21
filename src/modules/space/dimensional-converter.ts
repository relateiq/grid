import { Grid } from '../core';

const util = require('../util');

export type DimensionalSpaceCoordConverter = (spaceCoord: number) => number;

export interface IAbstractRowColModel {
  get: (i: number) => any;
  toVirtual: (i: number) => number;
  toData: (i: number) => number;
  length: (includeHeaders?: boolean) => number;
}

export interface IIndexOpts {
  from?: number;
  to?: number;
  length?: number;
  reverse?: boolean;
}

export abstract class AbstractDimensionalSpaceConverter {
  grid: Grid;
  abstract rowColModel: IAbstractRowColModel;
  constructor(grid: Grid) {
    this.grid = grid;
  }
  abstract toVirtual(spaceCoord: number): number;
  abstract toView(spaceCoord: number): number;
  abstract toData(spaceCoord: number): number;
  abstract count(): number;
  clamp(idx: number): number {
    return util.clamp(idx, 0, this.count() - 1);
  }
  prev(coord: number) {
    return this.iterateWhileHidden(-1, coord);
  }
  next(coord: number) {
    return this.iterateWhileHidden(1, coord);
  }
  get(coord: number) {
    return this.rowColModel.get(this.toVirtual(coord));
  }

  indexes(opts: IIndexOpts = {}) {
    opts.from = opts.from || 0;
    const count = this.count();
    opts.to = (opts.to && opts.to + 1) ||
      (opts.length && opts.length + opts.from) ||
      count;
    const indexes = [];
    for (let idx: number | undefined = Math.max(opts.from, 0);
      idx != undefined && idx < Math.min(opts.to, count);
      idx = opts.reverse ? this.prev(idx) : this.next(idx)) {
      indexes.push(idx);
    }
    return indexes;
  }
  iterate(opts: IIndexOpts, fn: (idx: number) => boolean | undefined): void;
  iterate(fn: (idx: number) => boolean | undefined): void;
  iterate() {
    let opts: IIndexOpts | undefined;
    let fn: (idx: number) => boolean | undefined;
    if (arguments.length === 2) {
      opts = arguments[0];
      fn = arguments[1];
    } else {
      fn = arguments[0];
    }
    this.indexes(opts).some((idx: number) => {
      return !!fn(idx);
    });
  }
  private iterateWhileHidden(step: number = 1, start: number) {
    for (let i = start + step; i < this.count() && i >= 0; i += step) {
      if (!this.get(i).hidden) {
        return i;
      }
    }
    return undefined;
  }
}