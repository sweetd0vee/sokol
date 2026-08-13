import type { FormEvent, ReactNode } from 'react';
import { useEffect } from 'react';
import { Button } from './Button';

const OVERLAY_CLASS = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4';
const CARD_CLASS =
  'w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-xl ';
const CARD_WIDE_CLASS =
  'w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-xl max-h-[90vh] overflow-y-auto ';

type ModalProps = {
  title: string;
  children: ReactNode;
  wide?: boolean;
  onClose?: () => void;
};

export function Modal({ title, children, wide, onClose }: ModalProps) {
  useEffect(() => {
    if (!onClose) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={OVERLAY_CLASS}
      onClick={onClose}
      role={onClose ? 'presentation' : undefined}
    >
      <div
        className={wide ? CARD_WIDE_CLASS : CARD_CLASS}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {children}
      </div>
    </div>
  );
}

type ModalActionsProps = {
  submitLabel?: string;
  cancelLabel?: string;
  submitDisabled?: boolean;
  onCancel: () => void;
};

export function ModalActions({
  submitLabel = 'Сохранить',
  cancelLabel = 'Отмена',
  submitDisabled,
  onCancel,
}: ModalActionsProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-lg border border-transparent bg-[#90EE90] px-6 py-2 text-sm font-medium text-gray-700 transition hover:bg-[#7fdc7f] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={submitDisabled}
      >
        {submitLabel}
      </button>
      <Button type="button" variant="secondary" onClick={onCancel}>
        {cancelLabel}
      </Button>
    </div>
  );
}

type ConfirmDialogProps = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Да',
  cancelLabel = 'Нет',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onConfirm();
  };

  return (
    <Modal title={title}>
      <form onSubmit={handleSubmit} className="mt-2 space-y-6">
        <div className="text-sm text-gray-600">{message}</div>
        <div className="flex items-center justify-center gap-3">
          <Button type="submit" variant="primary">
            {confirmLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
