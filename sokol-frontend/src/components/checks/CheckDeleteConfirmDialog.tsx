import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { FORM_INPUT_CLASS, FORM_LABEL_CLASS } from '../../constants/formLayout';
import { typedCheckKeyMatches } from '../../utils/checkDeleteConfirm';
import { pluralRecommendations } from '../../utils/pluralRu';

type CheckDeleteConfirmDialogProps = {
  serialNumber: string;
  confirmToken: string;
  recommendationCount: number;
  isDeleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function CheckDeleteConfirmDialog({
  serialNumber,
  confirmToken,
  recommendationCount,
  isDeleting = false,
  onConfirm,
  onCancel,
}: CheckDeleteConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const matches = typedCheckKeyMatches(confirmToken, typed);
  const recLabel = `${recommendationCount} ${pluralRecommendations(recommendationCount)}`;
  const keyLabel = serialNumber.trim() || confirmToken;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!matches || isDeleting) {
      return;
    }
    onConfirm();
  };

  return (
    <Modal title="Удаление проверки" onClose={isDeleting ? undefined : onCancel}>
      <form onSubmit={handleSubmit} className="mt-3 space-y-4 text-left">
        <p className="text-sm text-gray-700">
          Проверка «{keyLabel}» будет удалена безвозвратно. Отменить это нельзя.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>
            {recommendationCount === 0
              ? 'Рекомендаций у проверки нет'
              : `Будут удалены ${recLabel}`}
          </li>
          <li>Будут удалены все файлы проверки и рекомендаций в хранилище (MinIO)</li>
        </ul>
        <label className={`block ${FORM_LABEL_CLASS}`}>
          Чтобы подтвердить, введите ключ проверки
          <input
            autoFocus
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={confirmToken}
            autoComplete="off"
            spellCheck={false}
            disabled={isDeleting}
            className={`mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none ${FORM_INPUT_CLASS}`}
          />
        </label>
        <div className="flex items-center justify-center gap-3 pt-1">
          <Button
            type="submit"
            variant="primary"
            disabled={!matches || isDeleting}
            className="!bg-[#FF4347] hover:!bg-[#e03c40] disabled:!bg-[#FF4347]"
          >
            {isDeleting ? 'Удаляем…' : 'Удалить безвозвратно'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isDeleting}>
            Отмена
          </Button>
        </div>
      </form>
    </Modal>
  );
}
