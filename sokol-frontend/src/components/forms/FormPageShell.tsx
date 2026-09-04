import type { ReactNode } from 'react';
import { FORM_PAGE_CLASS, FORM_STACK_CLASS } from '../../constants/formLayout';
import { FormPageHeader } from './FormPageHeader';

export function FormPageShell({
  title,
  backTo,
  children,
}: {
  title: string;
  backTo: string;
  children: ReactNode;
}) {
  return (
    <div className={`${FORM_PAGE_CLASS} ${FORM_STACK_CLASS}`}>
      <FormPageHeader title={title} backTo={backTo} />
      {children}
    </div>
  );
}
