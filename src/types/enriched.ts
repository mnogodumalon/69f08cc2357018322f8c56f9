import type { Schichtplan } from './app';

export type EnrichedSchichtplan = Schichtplan & {
  schichttypName: string;
  mitarbeiterName: string;
};
