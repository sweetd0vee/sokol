import { describe, expect, it } from 'vitest';
import { buildParsedPreviewItem, patchPreviewItem, toRecommendationPayload } from './checkRecommendationsPreview';

const draft = {
  name: '  Текст  ',
  observation_name: '  Наблюдение  ',
  audit_object: '',
  deadline: '2026-09-01',
  auditor: '',
  manager: 'Петров',
  status: 'on_control' as const,
  additional_status: 'on_control' as const,
};

describe('buildParsedPreviewItem', () => {
  it('fills defaults and trims fields the same way as the former inline builder', () => {
    const item = buildParsedPreviewItem(draft, 0, 'П-1', 3);
    expect(item.serial_number).toBe('П-1');
    expect(item.sequence_number).toBe(4);
    expect(item.name).toBe('Текст');
    expect(item.observation_name).toBe('Наблюдение');
    expect(item.audit_object).toBe('Не указан');
    expect(item.auditor).toBe('Не указан');
    expect(item.manager).toBe('Петров');
    expect(item.materiality_level).toBe('средний');
  });
});

describe('patchPreviewItem', () => {
  const item = buildParsedPreviewItem(draft, 0, 'П-1', 0);

  it('keeps raw name and trimmed description', () => {
    const next = patchPreviewItem(item, 'name', '  Новое имя  ', (value) => value);
    expect(next.name).toBe('  Новое имя  ');
    expect(next.description).toBe('Новое имя');
  });

  it('falls back to the raw deadline when normalizer returns empty', () => {
    const next = patchPreviewItem(item, 'deadline', 'raw', () => '');
    expect(next.deadline).toBe('raw');
  });

  it('clips audit object and manager to 255 chars', () => {
    const long = 'x'.repeat(300);
    expect(patchPreviewItem(item, 'audit_object', long, (value) => value).audit_object).toHaveLength(255);
    expect(patchPreviewItem(item, 'manager', long, (value) => value).manager).toHaveLength(255);
  });
});

describe('toRecommendationPayload', () => {
  it('drops previewKey and wraps audit_object', () => {
    const item = buildParsedPreviewItem({ ...draft, audit_object: 'А; Б' }, 0, 'П-1', 0);
    const payload = toRecommendationPayload(item);
    expect(payload).not.toHaveProperty('previewKey');
    expect(payload.audit_object).toEqual(expect.any(Array));
  });
});
