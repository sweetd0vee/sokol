import { Download, Loader2, Trash2 } from 'lucide-react';
import { attachmentDownloadUrl } from '../../api/attachments';
import {
  formatFileSize,
  getFileExtension,
  type PersistedAttachmentListItem,
} from '../../utils/fileAttachments';

type AttachmentFileListProps = {
  items: PersistedAttachmentListItem[];
  onRemove: (clientId: string) => void;
  emptyMessage?: string;
};

export function AttachmentFileList({
  items,
  onRemove,
  emptyMessage = 'Файлы не прикреплены.',
}: AttachmentFileListProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg bg-gray-100 px-4 py-6 text-sm text-gray-500 dark:bg-slate-700 dark:text-slate-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-200 rounded-lg bg-gray-100 dark:divide-slate-700 dark:bg-slate-700">
      {items.map((item) => (
        <li key={item.clientId} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">{item.name}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {getFileExtension(item.name)} · {formatFileSize(item.size)}
              {item.status === 'uploading' && ' · загрузка…'}
              {item.status === 'error' && item.errorMessage ? ` · ${item.errorMessage}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {item.status === 'uploading' && (
              <span className="rounded-lg p-2 text-gray-400" aria-label="Загрузка">
                <Loader2 size={18} className="animate-spin" />
              </span>
            )}
            {item.status === 'saved' && item.serverId != null && (
              <a
                href={attachmentDownloadUrl(item.serverId)}
                download
                className="rounded-lg p-2 text-gray-400 transition hover:bg-blue-50 hover:text-[#6699FF] dark:hover:bg-slate-600"
                aria-label={`Скачать ${item.name}`}
              >
                <Download size={18} />
              </a>
            )}
            <button
              type="button"
              onClick={() => onRemove(item.clientId)}
              disabled={item.status === 'uploading'}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-red-950/30"
              aria-label={`Удалить ${item.name}`}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AttachmentsUnavailableNotice({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
      {message}
    </p>
  );
}
