import { Paperclip } from 'lucide-react';
import { filesWord } from '../../utils/fileHelpers';

export function AttachmentSlotCard({
  label,
  fileCount,
  onOpen,
}: {
  label: string;
  fileCount: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[6.5rem] w-full flex-col items-center justify-center gap-2 rounded-lg bg-gray-100 px-2 py-4 text-center leading-relaxed transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300/50"
    >
      <span className="text-sm font-semibold text-gray-800">{label}</span>
      {fileCount > 0 && (
        <span className="text-xs text-gray-500">
          {fileCount} {filesWord(fileCount)}
        </span>
      )}
      <span className="inline-flex items-center gap-1 text-sm font-medium text-[#6699FF]">
        <Paperclip size={14} />
        Управление вложениями
      </span>
    </button>
  );
}
