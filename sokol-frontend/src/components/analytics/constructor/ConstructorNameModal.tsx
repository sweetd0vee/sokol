import type { FormEvent } from 'react';
import { Modal, ModalActions } from '../../ui/Modal';
import { Input } from '../../ui/Input';
import { FORM_INPUT_CLASS } from '../../../constants/formLayout';

export function ConstructorNameModal({
  title,
  submitLabel,
  value,
  onChange,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) {
      return;
    }
    onSubmit();
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="mt-4 space-y-6 text-left">
        <Input
          label="Название"
          value={value}
          onChange={onChange}
          placeholder="Например, Отчёт за 3 квартал"
          inputClassName={FORM_INPUT_CLASS}
        />
        <ModalActions submitLabel={submitLabel} submitDisabled={!value.trim()} onCancel={onClose} />
      </form>
    </Modal>
  );
}
