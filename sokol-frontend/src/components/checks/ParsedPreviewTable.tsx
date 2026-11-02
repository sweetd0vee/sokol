import { Trash2 } from 'lucide-react';
import type { EditablePreviewField, ParsedPreviewItem } from '../../utils/checkRecommendationsPreview';
import { formatPreviewDeadline } from '../../utils/checkRecommendationsPreview';

const cellInputClass =
  'w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/30';
const cellTextareaClass = `${cellInputClass} min-h-[4.5rem] resize-y leading-snug`;

export function ParsedPreviewTable({
  items,
  expanded,
  onRemove,
  onChange,
}: {
  items: ParsedPreviewItem[];
  expanded: boolean;
  onRemove: (previewKey: string) => void;
  onChange?: (previewKey: string, field: EditablePreviewField, value: string) => void;
}) {
  const nameClamp = expanded ? '' : 'line-clamp-3';
  const cellClamp = expanded ? '' : 'line-clamp-2';
  const editable = Boolean(expanded && onChange);

  return (
    <table className={`w-full table-fixed ${expanded ? 'text-base' : 'text-sm'}`}>
      <colgroup>
        <col className={expanded ? 'w-14' : 'w-12'} />
        <col />
        <col className={expanded ? 'w-[16%]' : 'w-[15%]'} />
        <col className={expanded ? 'w-[14%]' : 'w-[13%]'} />
        <col className={expanded ? 'w-[12%]' : 'w-[11%]'} />
        <col className={expanded ? 'w-[12%]' : 'w-[11%]'} />
        <col className={expanded ? 'w-40' : 'w-32'} />
        <col className="w-10" />
      </colgroup>
      <thead className="sticky top-0 z-10">
        <tr className="bg-gray-100 text-gray-800">
          <th className="px-3 py-2.5 text-left font-medium">№</th>
          <th className="px-3 py-2.5 text-left font-medium">Рекомендация</th>
          <th className="px-3 py-2.5 text-left font-medium">Наблюдение</th>
          <th className="px-3 py-2.5 text-left font-medium">Объект аудита</th>
          <th className="px-3 py-2.5 text-left font-medium">Руководитель</th>
          <th className="px-3 py-2.5 text-left font-medium">Аудитор</th>
          <th className="px-3 py-2.5 text-left font-medium">Срок исполнения</th>
          <th className="px-2 py-2.5 text-center font-medium">
            <span className="sr-only">Удалить</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {items.map((item, index) => (
          <tr key={item.previewKey} className="bg-white transition hover:bg-slate-50">
            <td className="px-3 py-2.5 align-top tabular-nums text-gray-500">{index + 1}</td>
            <td className="px-3 py-2.5 align-top text-gray-900">
              {editable ? (
                <textarea
                  value={item.name}
                  onChange={(event) => onChange?.(item.previewKey, 'name', event.target.value)}
                  rows={3}
                  className={cellTextareaClass}
                  aria-label={`Рекомендация ${index + 1}`}
                />
              ) : (
                <p className={`${nameClamp} whitespace-pre-wrap break-words leading-snug`}>
                  {item.name || '—'}
                </p>
              )}
            </td>
            <td className="px-3 py-2.5 align-top text-gray-700">
              {editable ? (
                <textarea
                  value={item.observation_name ?? ''}
                  onChange={(event) =>
                    onChange?.(item.previewKey, 'observation_name', event.target.value)
                  }
                  rows={2}
                  className={cellTextareaClass}
                  aria-label={`Наблюдение ${index + 1}`}
                />
              ) : (
                <span className={`${cellClamp} break-words`}>{item.observation_name || '—'}</span>
              )}
            </td>
            <td className="px-3 py-2.5 align-top text-gray-700">
              {editable ? (
                <textarea
                  value={item.audit_object}
                  onChange={(event) =>
                    onChange?.(item.previewKey, 'audit_object', event.target.value)
                  }
                  rows={2}
                  className={cellTextareaClass}
                  aria-label={`Объект аудита ${index + 1}`}
                />
              ) : (
                <span className={`${cellClamp} break-words`}>{item.audit_object}</span>
              )}
            </td>
            <td className="px-3 py-2.5 align-top text-gray-700">
              {editable ? (
                <input
                  type="text"
                  value={item.manager}
                  onChange={(event) => onChange?.(item.previewKey, 'manager', event.target.value)}
                  className={cellInputClass}
                  aria-label={`Руководитель ${index + 1}`}
                />
              ) : (
                <span className={`${cellClamp} break-words`}>{item.manager}</span>
              )}
            </td>
            <td className="px-3 py-2.5 align-top text-gray-700">
              {editable ? (
                <input
                  type="text"
                  value={item.auditor}
                  onChange={(event) => onChange?.(item.previewKey, 'auditor', event.target.value)}
                  className={cellInputClass}
                  aria-label={`Аудитор ${index + 1}`}
                />
              ) : (
                <span className={`${cellClamp} break-words`}>{item.auditor || '—'}</span>
              )}
            </td>
            <td className="px-3 py-2.5 align-top text-gray-700">
              {editable && item.deadline ? (
                <input
                  type="date"
                  value={item.deadline}
                  onChange={(event) => onChange?.(item.previewKey, 'deadline', event.target.value)}
                  className={cellInputClass}
                  aria-label={`Срок ${index + 1}`}
                />
              ) : (
                <span className="break-words">{formatPreviewDeadline(item)}</span>
              )}
            </td>
            <td className="px-2 py-2.5 align-top text-center">
              <button
                type="button"
                onClick={() => onRemove(item.previewKey)}
                title="Убрать из списка"
                aria-label={`Убрать рекомендацию ${index + 1}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
              >
                <Trash2 size={14} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
