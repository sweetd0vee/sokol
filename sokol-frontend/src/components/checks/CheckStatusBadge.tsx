import type { CheckStatus } from '../../types/check';
import { getCheckStatusBadgeClass, getCheckStatusLabel } from '../../constants/checks';

export function CheckStatusBadge({ status }: { status: CheckStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-base font-medium text-gray-800 whitespace-nowrap ${getCheckStatusBadgeClass(status)}`}
    >
      {getCheckStatusLabel(status)}
    </span>
  );
}
