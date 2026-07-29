import type { Check, CheckType } from '../types/check';

const CHECK_TYPE_KEY_CODES: Record<CheckType, string> = {
  planned: 'P',
  unscheduled: 'V',
  thematic: 'K',
};

type CheckKeySeed = {
  leader: string;
  startDate: string;
  checkType: CheckType;
};

const TRANSLIT_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ы: 'y',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ъ: '',
  ь: '',
};

function parseIsoDate(value: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function transliterateChar(char: string) {
  return (TRANSLIT_MAP[char.toLowerCase()] ?? char).toUpperCase();
}

/** Фамилия и инициалы → латиница, например «Ковалев В.В.» → KVV */
function getLeaderInitialsCode(fullName: string) {
  return fullName
    .replace(/\./g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => transliterateChar(part.charAt(0)))
    .join('');
}

function getMonthCode(date: Date) {
  return String(date.getMonth() + 1).padStart(2, '0');
}

function isSameYearAndMonth(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth();
}

function countMatchingCheckKeys(
  leader: string,
  startDate: Date,
  checkType: CheckType,
  existing: CheckKeySeed[],
) {
  return existing.filter((check) => {
    if (check.leader !== leader || check.checkType !== checkType) {
      return false;
    }
    const checkDate = parseIsoDate(check.startDate);
    return checkDate !== null && isSameYearAndMonth(checkDate, startDate);
  }).length;
}

export function generateCheckSerialNumber(params: {
  startDate: Date;
  checkLeader: string;
  checkType: CheckType;
  existing: CheckKeySeed[];
}) {
  const { startDate, checkLeader, checkType, existing } = params;
  const yearCode = String(startDate.getFullYear()).slice(-2);
  const leaderCode = getLeaderInitialsCode(checkLeader);
  const monthCode = getMonthCode(startDate);
  const typeCode = CHECK_TYPE_KEY_CODES[checkType] ?? '';
  const nextNumber = countMatchingCheckKeys(checkLeader, startDate, checkType, existing) + 1;
  return `${yearCode}${leaderCode}${monthCode}${typeCode}${nextNumber}`;
}

export function buildCheckKeySeeds(
  checks: Pick<Check, 'check_leader' | 'start_date' | 'check_type'>[],
): CheckKeySeed[] {
  return checks.map((check) => ({
    leader: check.check_leader,
    startDate: check.start_date,
    checkType: check.check_type,
  }));
}
