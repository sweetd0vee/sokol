import { describe, expect, it } from 'vitest';
import { userCanManageCheck, userCanManageRecommendation } from './personMatch';

describe('record access', () => {
  it('lets an admin manage any check and recommendation', () => {
    expect(userCanManageCheck({
      isAdmin: true,
      userName: 'Админ А.А.',
      checkLeader: 'Иванов И.И.',
    })).toBe(true);
    expect(userCanManageRecommendation({
      isAdmin: true,
      userName: 'Админ А.А.',
      auditor: 'Иванов И.И.',
    })).toBe(true);
  });

  it('lets an auditor manage a check they lead or created', () => {
    expect(userCanManageCheck({
      isAdmin: false,
      userName: 'Важник Д.С.',
      checkLeader: 'Важник Дмитрий Сергеевич',
    })).toBe(true);
    expect(userCanManageCheck({
      isAdmin: false,
      userName: 'Важник Д.С.',
      checkLeader: 'Иванов И.И.',
      createdBy: 'Важник Д.С.',
    })).toBe(true);
    expect(userCanManageCheck({
      isAdmin: false,
      userName: 'Важник Д.С.',
      checkLeader: 'Иванов И.И.',
      createdBy: 'Петров П.П.',
    })).toBe(false);
  });

  it('lets an auditor manage a recommendation they audit, lead, or created', () => {
    expect(userCanManageRecommendation({
      isAdmin: false,
      userName: 'Важник Д.С.',
      auditor: 'Важник Д.С.',
    })).toBe(true);
    expect(userCanManageRecommendation({
      isAdmin: false,
      userName: 'Важник Д.С.',
      auditor: 'Иванов И.И.',
      checkLeader: 'Важник Д.С.',
    })).toBe(true);
    expect(userCanManageRecommendation({
      isAdmin: false,
      userName: 'Важник Д.С.',
      auditor: 'Иванов И.И.',
      createdBy: 'Важник Д.С.',
    })).toBe(true);
    expect(userCanManageRecommendation({
      isAdmin: false,
      userName: 'Важник Д.С.',
      auditor: 'Иванов И.И.',
      checkCreatedBy: 'Важник Д.С.',
    })).toBe(true);
    expect(userCanManageRecommendation({
      isAdmin: false,
      userName: 'Важник Д.С.',
      auditor: 'Иванов И.И.',
      checkLeader: 'Петров П.П.',
    })).toBe(false);
  });
});
