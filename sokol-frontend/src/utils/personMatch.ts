function normalizePersonValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parsePersonParts(value: string) {
  const parts = value
    .replace(/\./g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { surname: '', initials: '' };
  }

  const surname = parts[0].toLowerCase();
  const initials = parts
    .slice(1)
    .map((part) => part.charAt(0).toLowerCase())
    .join('');

  return { surname, initials };
}

function buildInitialsPatterns(initials: string) {
  if (!initials) {
    return [];
  }

  const dotted = `${initials.split('').join('.')}.`;
  return [dotted, dotted.slice(0, -1), initials, initials.split('').join(' ')];
}

/** Совпадение по фамилии и инициалам, например «Иванов А.А.» и «Иванов Александр Александрович». */
function personFieldMatchesUser(personField: string, userFullName: string) {
  const field = personField.trim();
  const user = userFullName.trim();

  if (!field || !user) {
    return false;
  }

  if (normalizePersonValue(field) === normalizePersonValue(user)) {
    return true;
  }

  const fieldParts = parsePersonParts(field);
  const userParts = parsePersonParts(user);

  if (!fieldParts.surname || !userParts.surname) {
    return false;
  }

  if (fieldParts.surname !== userParts.surname) {
    return false;
  }

  if (!userParts.initials) {
    return true;
  }

  if (fieldParts.initials) {
    const sharedLength = Math.min(fieldParts.initials.length, userParts.initials.length);
    for (let index = 0; index < sharedLength; index += 1) {
      if (fieldParts.initials[index] !== userParts.initials[index]) {
        return false;
      }
    }
    if (fieldParts.initials.length >= userParts.initials.length) {
      return true;
    }
  }

  const fieldLower = field.toLowerCase();
  return buildInitialsPatterns(userParts.initials).some((pattern) => fieldLower.includes(pattern));
}

export function auditorMatchesCurrentUser(auditor: string, userFullName: string) {
  return personFieldMatchesUser(auditor, userFullName);
}

export function recommendationMatchesCurrentUser(
  recommendation: { auditor: string; manager: string },
  userFullName: string,
) {
  return (
    personFieldMatchesUser(recommendation.auditor, userFullName)
    || personFieldMatchesUser(recommendation.manager, userFullName)
  );
}
