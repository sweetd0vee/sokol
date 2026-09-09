import type { ReactNode } from 'react';
import { FORM_PAGE_CLASS, FORM_STACK_CLASS } from '../../constants/formLayout';
import { FormPageHeader } from './FormPageHeader';

export function FormPageShell({
  title,
  backTo,
  backLabel,
  actions,
  children,
}: {
  title: string;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`${FORM_PAGE_CLASS} ${FORM_STACK_CLASS}`}>
      <FormPageHeader title={title} backTo={backTo} backLabel={backLabel} actions={actions} />
      {children}
    </div>
  );
}
