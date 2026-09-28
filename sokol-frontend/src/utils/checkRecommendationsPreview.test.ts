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

  it('ставит серые песочные часы и серый колокольчик, если срок контроля ещё не наступил', () => {
    const item = buildParsedPreviewItem({ ...draft, deadline: '2099-01-01' }, 0, 'П-1', 0);
    expect(item).toMatchObject({
      status: 'on_control',
      indicator: 'на контроле',
      additional_status: 'on_control',
      additional_indicator: 'на контроле',
    });
  });

  it('ставит синюю звезду и зелёный «в срок», если вместо срока написано «исполнено в ходе аудита»', () => {
    const item = buildParsedPreviewItem(
      { ...draft, deadline: '', completed_during_audit: true },
      0,
      'П-1',
      0,
    );
    expect(item).toMatchObject({
      deadline: '',
      status: 'completed',
      indicator: 'исполнено в ходе аудита',
      additional_status: 'on_time',
      additional_indicator: 'в срок',
    });
  });

  it('ставит красный треугольник и красный колокольчик, если срок контроля уже прошёл', () => {
    const item = buildParsedPreviewItem({ ...draft, deadline: '2000-01-01' }, 0, 'П-1', 0);
    expect(item).toMatchObject({
      status: 'unresolved',
      indicator: 'не решено',
      additional_status: 'deadline_violated',
      additional_indicator: 'срок нарушен',
    });
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

  it('пересчитывает оба индикатора при смене срока контроля', () => {
    const overdue = patchPreviewItem(item, 'deadline', '2000-01-01', (value) => value);
    expect(overdue).toMatchObject({
      deadline: '2000-01-01',
      status: 'unresolved',
      indicator: 'не решено',
      additional_status: 'deadline_violated',
      additional_indicator: 'срок нарушен',
    });

    const upcoming = patchPreviewItem(overdue, 'deadline', '2099-01-01', (value) => value);
    expect(upcoming).toMatchObject({
      deadline: '2099-01-01',
      status: 'on_control',
      indicator: 'на контроле',
      additional_status: 'on_control',
      additional_indicator: 'на контроле',
    });
  });

  it('ставит синюю звезду и зелёный «в срок» при фразе «исполнено в ходе аудита»', () => {
    const next = patchPreviewItem(item, 'deadline', 'исполнено в ходе аудита', (value) => value);
    expect(next).toMatchObject({
      deadline: '',
      status: 'completed',
      indicator: 'исполнено в ходе аудита',
      additional_status: 'on_time',
      additional_indicator: 'в срок',
    });
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
