import { describe, expect, it } from 'vitest';
import { APP_NAV_ITEMS, visibleNavItems } from './nav';

describe('visibleNavItems', () => {
  it('hides settings from auditors and shows them to admins', () => {
    const auditor = visibleNavItems(false).map((item) => item.id);
    const admin = visibleNavItems(true).map((item) => item.id);

    expect(auditor).not.toContain('settings');
    expect(admin).toContain('settings');
    expect(admin).toEqual(APP_NAV_ITEMS.map((item) => item.id));
  });
});
