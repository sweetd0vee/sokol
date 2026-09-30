/** Shared chart datum shapes used by analytics UI and constructor payloads. */

export type DonutDatum = {
  name: string;
  value: number;
  color?: string;
};

export type TreemapViewBreakdown = {
  name: string;
  value: number;
};

export type TreemapDatum = {
  name: string;
  value: number;
  fill?: string;
  materiality?: {
    низкий: number;
    средний: number;
    высокий: number;
  };
  views?: TreemapViewBreakdown[];
};
