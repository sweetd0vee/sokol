/** Shared layout tokens for check / recommendation edit forms. */

/** Moderately wide edit form, left-aligned in the content area. */
export const FORM_PAGE_CLASS = 'w-full max-w-7xl';

/** Vertical gap between major form sections. */
export const FORM_STACK_CLASS = 'space-y-8';

const FORM_SECTION_CLASS =
  'space-y-5 rounded-lg border border-[#b8bec8] bg-white p-5 leading-relaxed';

/** Section with all required fields already filled — skip while scanning the form. */
const FORM_FILLED_SECTION_CLASS =
  'space-y-5 rounded-lg border border-[#b8bec8] bg-white p-5 leading-relaxed';

export function formSectionClass(filled: boolean) {
  return filled ? FORM_FILLED_SECTION_CLASS : FORM_SECTION_CLASS;
}

/** Shared inner spacing inside a form section (matches section space-y). */
export const FORM_SECTION_INNER_STACK_CLASS = 'space-y-5';

export const FORM_SECTION_TITLE_CLASS = 'text-lg font-semibold leading-snug text-gray-900';

export const FORM_LABEL_CLASS = 'text-sm leading-relaxed';

/** Default field chrome — soft gray border, muted focus (no bright blue outline). */
export const FORM_INPUT_CLASS =
  'text-sm py-1.5 leading-relaxed focus:!border-gray-400 focus:!ring-gray-300/40';

/**
 * Field rows (see index.css).
 * All field boxes share the 4-column width and the same gutters; a 3-field row stays left-aligned.
 */
export const FORM_ROW_3 = 'form-row-3';

export const FORM_ROW_4 = 'form-row-4';

/** Prevent grid/flex children from overflowing. */
export const FORM_FIELD_CLASS = 'min-w-0 w-full';

/** Wider text field in a 3-column row — fills leftover space to the right. */
export const FORM_FIELD_WIDE_CLASS = 'form-field-wide min-w-0';

/** Shared list action sizes: Мои/Создать and table action buttons. */
export const LIST_ACTION_BUTTON_CLASS =
  'inline-flex w-[160px] items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium';
export const LIST_ACTION_GROUP_CLASS = 'ml-auto flex w-[334px] items-center justify-end gap-3.5 whitespace-nowrap';
/** Equal width for primary action buttons across forms and lists. */
export const FORM_ACTION_BUTTON_CLASS = 'w-[160px] justify-center whitespace-nowrap';
