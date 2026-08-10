/** Shared layout tokens for check / recommendation edit forms. */

/** Moderately wide edit form, left-aligned in the content area. */
export const FORM_PAGE_CLASS = 'w-full max-w-7xl';

/** Vertical gap between major form sections. */
export const FORM_STACK_CLASS = 'space-y-8';

/** Shared inner spacing inside a form section (matches section space-y). */
export const FORM_SECTION_INNER_STACK_CLASS = 'space-y-5';

/** Card chrome for major form sections. */
export const FORM_SECTION_CLASS =
  'space-y-5 rounded-lg border border-[#b8bec8] bg-white p-5 leading-relaxed';

export const FORM_SECTION_TITLE_CLASS = 'text-lg font-semibold leading-snug text-gray-900';

export const FORM_LABEL_CLASS = 'text-sm leading-relaxed';

/** Default field chrome — soft gray border, muted focus (no bright blue outline). */
export const FORM_INPUT_CLASS =
  'text-sm py-1.5 leading-relaxed focus:!border-gray-400 focus:!ring-gray-300/40';

export const FORM_TEXTAREA_CLASS =
  `${FORM_INPUT_CLASS} min-h-[6.5rem] max-h-48 resize-none overflow-y-auto`;

export const FORM_SERVICE_INPUT_CLASS = `${FORM_INPUT_CLASS} bg-green-100`;

export const FORM_EQUAL_CONTROL_CLASS = `form-equal-control ${FORM_INPUT_CLASS}`;

export const FORM_FIELD_ERROR_CLASS =
  'border-[#e59a9a] focus:border-[#d9534f] focus:ring-[#f3c5c5]';

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

/** Spans two standard field boxes in a 3/4-column form row. */
export const FORM_FIELD_SPAN_2_CLASS = 'form-field-span-2 min-w-0';

/** Shared list action sizes: Мои/Создать and table action buttons. */
export const LIST_ACTION_BUTTON_CLASS =
  'inline-flex w-[160px] items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium';
export const LIST_ACTION_GROUP_CLASS = 'ml-auto flex w-[334px] items-center justify-end gap-3.5 whitespace-nowrap';

/** Equal width for primary action buttons across forms and lists. */
export const FORM_ACTION_BUTTON_CLASS = 'w-[160px] justify-center whitespace-nowrap';

export const FORM_OUTLINE_BUTTON_CLASS = `inline-flex items-center rounded-lg border-2 border-[#6699FF] px-3 py-1.5 text-sm font-medium text-[#6699FF] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white ${FORM_ACTION_BUTTON_CLASS}`;

export const FORM_SAVE_BUTTON_CLASS = `inline-flex items-center rounded-lg bg-[#90EE90] px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-[#7fdc7f] ${FORM_ACTION_BUTTON_CLASS}`;
