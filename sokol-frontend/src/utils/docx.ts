const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const ACCEPTED_DOCX = `.docx,${DOCX_MIME}`;

export const DOCX_TOOL_TIMEOUT_MS = 600_000;

export const isDocxFile = (file: File) =>
  file.name.toLowerCase().endsWith('.docx') || file.type === DOCX_MIME;
