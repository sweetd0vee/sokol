export const AUTH_UNAUTHORIZED_EVENT = 'sokol:auth-unauthorized';

export const COMPACT_FORM_PATHS = [
  /^\/recommendations\/new$/,
  /^\/recommendations\/[^/]+\/edit$/,
  /^\/checks\/new$/,
  /^\/checks\/[^/]+\/edit$/,
];

export function isCompactFormPath(pathname: string) {
  return COMPACT_FORM_PATHS.some((pattern) => pattern.test(pathname));
}
