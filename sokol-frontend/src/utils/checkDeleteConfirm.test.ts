import { describe, expect, it } from 'vitest';
import { checkDeleteConfirmToken, typedCheckKeyMatches } from './checkDeleteConfirm';

describe('checkDeleteConfirmToken', () => {
  it('prefers serial number', () => {
    expect(checkDeleteConfirmToken({ serial_number: ' 26KVS3P1 ', check_name: 'Проверка' })).toBe(
      '26KVS3P1',
    );
  });

  it('falls back to check name', () => {
    expect(checkDeleteConfirmToken({ serial_number: '  ', check_name: ' Квартальная ' })).toBe(
      'Квартальная',
    );
  });
});

describe('typedCheckKeyMatches', () => {
  it('matches ignoring case and surrounding spaces', () => {
    expect(typedCheckKeyMatches('26KVS3P1', ' 26kvs3p1 ')).toBe(true);
  });

  it('rejects a partial or empty token', () => {
    expect(typedCheckKeyMatches('26KVS3P1', '26KVS')).toBe(false);
    expect(typedCheckKeyMatches('', 'anything')).toBe(false);
  });
});
