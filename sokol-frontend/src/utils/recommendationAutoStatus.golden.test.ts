import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { computeRecommendationAutoStatus } from './recommendationAutoStatus';

type GoldenCase = {
  id: string;
  input: {
    controlDeadline: string | null;
    executionDate: string | null;
    removedFromControl: boolean;
    currentIndicator: string | null;
  };
  expected: {
    status: string;
    indicator: string;
    additionalStatus: string;
    additionalIndicator: string;
  } | null;
};

const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docs/fixtures/auto_status_golden.json',
);

const golden = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
  today: string;
  cases: GoldenCase[];
};

describe('computeRecommendationAutoStatus golden fixture', () => {
  it('shares the same cases with the backend engine', () => {
    expect(golden.cases.length).toBeGreaterThanOrEqual(10);

    for (const testCase of golden.cases) {
      const actual = computeRecommendationAutoStatus({
        controlDeadline: testCase.input.controlDeadline,
        executionDate: testCase.input.executionDate,
        removedFromControl: testCase.input.removedFromControl,
        currentIndicator: testCase.input.currentIndicator,
        today: golden.today,
      });
      if (testCase.expected === null) {
        expect(actual, testCase.id).toEqual({});
        continue;
      }
      expect(actual, testCase.id).toEqual(testCase.expected);
    }
  });
});
