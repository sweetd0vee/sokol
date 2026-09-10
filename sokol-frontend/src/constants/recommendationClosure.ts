export const RECOMMENDATION_ATTACHMENT_SLOTS = [
  { id: 'recommendation_files', label: 'Вложения' },
] as const;

export const RECOMMENDATION_CONTROL_REMOVAL_ATTACHMENT_SLOTS = [
  { id: 'control_removal_files', label: 'Вложения' },
] as const;

export type ClosureDateCommentRow = {
  id: string;
  date: string;
  comment: string;
};

export type RecommendationClosureForm = {
  closureInformation: string;
  actualCompletionDate: string;
  extensions: ClosureDateCommentRow[];
  removals: ClosureDateCommentRow[];
};

let closureRowSeq = 0;

export function createClosureDateCommentRow(
  partial?: Partial<Pick<ClosureDateCommentRow, 'date' | 'comment'>>,
): ClosureDateCommentRow {
  closureRowSeq += 1;
  return {
    id: `closure-row-${closureRowSeq}`,
    date: partial?.date ?? '',
    comment: partial?.comment ?? '',
  };
}

export function createEmptyRecommendationClosure(): RecommendationClosureForm {
  return {
    closureInformation: '',
    actualCompletionDate: '',
    extensions: [createClosureDateCommentRow()],
    removals: [createClosureDateCommentRow()],
  };
}

type ClosureListItem = { date?: string | null; comment?: string | null };

function rowsFromList(items?: ClosureListItem[] | null): ClosureDateCommentRow[] {
  if (!items?.length) {
    return [createClosureDateCommentRow()];
  }
  return items.map((item) =>
    createClosureDateCommentRow({
      date: item.date ?? '',
      comment: item.comment ?? '',
    }),
  );
}

function legacyExtensions(source?: {
  extension_1_date?: string;
  extension_1_comment?: string;
  extension_2_reason?: string;
  extension_2_comment?: string;
}): ClosureDateCommentRow[] {
  const extensions: ClosureDateCommentRow[] = [];
  if (source?.extension_1_date || source?.extension_1_comment) {
    extensions.push(
      createClosureDateCommentRow({
        date: source.extension_1_date ?? '',
        comment: source.extension_1_comment ?? '',
      }),
    );
  }
  if (source?.extension_2_comment || source?.extension_2_reason) {
    extensions.push(
      createClosureDateCommentRow({
        date: source.extension_2_reason ?? '',
        comment: source.extension_2_comment ?? '',
      }),
    );
  }
  return extensions.length ? extensions : [createClosureDateCommentRow()];
}

function legacyRemovals(source?: {
  remove_from_control_date?: string;
  remove_from_control_comment?: string;
}): ClosureDateCommentRow[] {
  if (source?.remove_from_control_date || source?.remove_from_control_comment) {
    return [
      createClosureDateCommentRow({
        date: source.remove_from_control_date ?? '',
        comment: source.remove_from_control_comment ?? '',
      }),
    ];
  }
  return [createClosureDateCommentRow()];
}

function toStoredItems(rows: ClosureDateCommentRow[]): ClosureListItem[] {
  return rows
    .map((row) => ({
      date: row.date.trim() || null,
      comment: row.comment.trim() || null,
    }))
    .filter((item) => item.date || item.comment);
}

type ControlZoneDateSource = {
  actual_completion_date?: string | null;
  deadline_extensions?: ClosureListItem[] | null;
  extension_1_date?: string | null;
  extension_2_reason?: string | null;
  actualCompletionDate?: string | null;
  extensions?: Pick<ClosureDateCommentRow, 'date'>[] | null;
};

function isoDateOrNull(value?: string | null): string | undefined {
  const cleaned = value?.trim().slice(0, 10) ?? '';
  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : undefined;
}

/**
 * Срок исполнения из контрольной зоны: дата фактического исполнения,
 * иначе последний перенос срока. Не отдельное поле карточки.
 */
export function getControlZoneExecutionDate(
  source?: ControlZoneDateSource | null,
): string | undefined {
  if (!source) {
    return undefined;
  }
  const actual = isoDateOrNull(source.actual_completion_date ?? source.actualCompletionDate);
  if (actual) {
    return actual;
  }
  const dates: string[] = [];
  const extensionRows = source.deadline_extensions ?? source.extensions ?? [];
  for (const item of extensionRows) {
    const date = isoDateOrNull(item.date);
    if (date) {
      dates.push(date);
    }
  }
  const legacyFirst = isoDateOrNull(source.extension_1_date);
  if (legacyFirst) {
    dates.push(legacyFirst);
  }
  const legacySecond = isoDateOrNull(source.extension_2_reason);
  if (legacySecond) {
    dates.push(legacySecond);
  }
  if (!dates.length) {
    return undefined;
  }
  return dates.sort()[dates.length - 1];
}

/** Comments from «Срок исполнения» and «Снять с контроля» — информация о выполнении. */
export function getRecommendationExecutionInfo(
  source?: Parameters<typeof closureFromRecommendation>[0],
): string {
  const closure = closureFromRecommendation(source);
  const parts: string[] = [];
  const closureInformation = closure.closureInformation.trim();
  if (closureInformation) {
    parts.push(closureInformation);
  }
  closure.removals.forEach((row) => {
    const comment = row.comment.trim();
    if (comment && !parts.includes(comment)) {
      parts.push(comment);
    }
  });
  return parts.join('\n\n');
}

export function closureFromRecommendation(
  source?: Partial<{
    closure_information?: string;
    actual_completion_date?: string;
    extension_1_reason?: string;
    extension_1_date?: string;
    extension_1_comment?: string;
    extension_2_reason?: string;
    extension_2_comment?: string;
    remove_from_control_reason?: string;
    remove_from_control_date?: string;
    remove_from_control_comment?: string;
    deadline_extensions?: ClosureListItem[] | null;
    control_removals?: ClosureListItem[] | null;
  }>,
): RecommendationClosureForm {
  return {
    closureInformation: source?.closure_information ?? '',
    actualCompletionDate: source?.actual_completion_date ?? '',
    extensions: source?.deadline_extensions?.length
      ? rowsFromList(source.deadline_extensions)
      : legacyExtensions(source),
    removals: source?.control_removals?.length
      ? rowsFromList(source.control_removals)
      : legacyRemovals(source),
  };
}

export function closureToRecommendationFields(form: RecommendationClosureForm) {
  const deadlineExtensions = toStoredItems(form.extensions);
  const controlRemovals = toStoredItems(form.removals);
  const firstExtension = deadlineExtensions[0];
  const secondExtension = deadlineExtensions[1];
  const firstRemoval = controlRemovals[0];

  return {
    closure_information: form.closureInformation || undefined,
    actual_completion_date: form.actualCompletionDate || undefined,
    deadline_extensions: deadlineExtensions,
    control_removals: controlRemovals,
    extension_1_reason: undefined,
    extension_1_date: firstExtension?.date || undefined,
    extension_1_comment: firstExtension?.comment || undefined,
    extension_2_reason: secondExtension?.date || undefined,
    extension_2_comment: secondExtension?.comment || undefined,
    remove_from_control_reason: undefined,
    remove_from_control_date: firstRemoval?.date || undefined,
    remove_from_control_comment: firstRemoval?.comment || undefined,
  };
}

export function isClosureRowIncomplete(row: ClosureDateCommentRow) {
  const hasDate = Boolean(row.date.trim());
  const hasComment = Boolean(row.comment.trim());
  return hasDate !== hasComment;
}

export function hasIncompleteClosureRows(rows: ClosureDateCommentRow[]) {
  return rows.some(isClosureRowIncomplete);
}
