const AUDIT_OBJECT_SEPARATOR = /[;,]/;

export function getRecommendationAuditObjects(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => getRecommendationAuditObjects(item));
  }

  const raw = value?.trim() ?? '';
  if (!raw) {
    return [];
  }

  const parts = raw
    .split(AUDIT_OBJECT_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [raw];
}

export function formatRecommendationAuditObjects(value: string | string[] | null | undefined): string {
  const parts = getRecommendationAuditObjects(value);
  return parts.length > 0 ? parts.join('; ') : '';
}
