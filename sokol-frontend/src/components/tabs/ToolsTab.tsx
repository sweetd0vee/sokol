import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { DocxToolPanel } from '../tools/DocxToolPanel';
import { DatePicker } from '../ui/DatePicker';
import { Select } from '../ui/Select';
import {
  downloadControlFileTemplate,
  generateControlFile,
  generateMemorandum,
  generateSectionIITemplate,
  generateSectionIIWithLinks,
} from '../../api/tools';
import { fetchCapabilities } from '../../api/capabilities';
import { queryKeys } from '../../api/queryKeys';
import { getErrorMessage } from '../../api/errors';
import { downloadBlob } from '../../utils/download';
import { isDocxFile } from '../../utils/docx';
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_MAX_UPLOAD_MB,
  isFileWithinUploadLimit,
  uploadLimitError,
} from '../../utils/uploadLimits';
import { toIsoDate } from '../../utils/dates';
import { useAuditorOptions } from '../../hooks/useReferenceOptions';
import { useDocxToolJob } from '../../hooks/useDocxToolJob';
import {
  FORM_SECTION_CLASS,
  FORM_SECTION_TITLE_CLASS,
  FORM_STACK_CLASS,
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
} from '../../constants/formLayout';

const TOOL_TABS = [
  { value: 'az' as const, label: 'АЗ' },
  { value: 'dz' as const, label: 'ДЗ' },
];

const TOOLS_SECTION_CLASS = `${FORM_SECTION_CLASS} w-full border-0`;
const TOOLS_SECTION_TITLE_CLASS = `${FORM_SECTION_TITLE_CLASS}`;

const buildSectionIIOutputName = (name: string, withHyperlinks = false) =>
  `${name.replace(/\.docx$/i, '')}${withHyperlinks ? '_section_ii_links' : '_section_ii'}.docx`;
const buildMemorandumOutputName = (name: string) => `${name.replace(/\.docx$/i, '')}_dz.docx`;
const buildControlFileOutputName = (name: string) => `${name.replace(/\.docx$/i, '')}_control.xlsx`;
const CONTROL_FILE_TEMPLATE_NAME = 'файл контроля шаблон (шапка).xlsx';
const FALLBACK_PROCESS_ERROR = 'Не удалось обработать файл. Проверьте подключение к API.';

export function ToolsTab() {
  const [activeTab, setActiveTab] = useState<'az' | 'dz'>('az');
  const [azControlLeader, setAzControlLeader] = useState('');
  const [azControlDate, setAzControlDate] = useState<Date | null>(null);
  const [isControlTemplateDownloading, setIsControlTemplateDownloading] = useState(false);
  const capabilitiesQuery = useQuery({
    queryKey: queryKeys.capabilities,
    queryFn: fetchCapabilities,
    staleTime: 5 * 60 * 1000,
  });
  const maxUploadMb = capabilitiesQuery.data?.max_upload_mb ?? DEFAULT_MAX_UPLOAD_MB;
  const maxUploadBytes = capabilitiesQuery.data?.max_upload_bytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  const { options: controlLeaderOptions } = useAuditorOptions(azControlLeader);

  const validateDocxFile = (file: File | null) => {
    if (!file) {
      return null;
    }
    if (!isDocxFile(file)) {
      return 'Файл должен быть в формате .docx.';
    }
    if (!isFileWithinUploadLimit(file, maxUploadBytes)) {
      return uploadLimitError(file, maxUploadMb);
    }
    return null;
  };

  const azJob = useDocxToolJob({
    process: generateSectionIITemplate,
    outputName: (name) => buildSectionIIOutputName(name),
    fallbackError: FALLBACK_PROCESS_ERROR,
    validate: validateDocxFile,
  });
  const azLinksJob = useDocxToolJob({
    process: generateSectionIIWithLinks,
    outputName: (name) => buildSectionIIOutputName(name, true),
    fallbackError: FALLBACK_PROCESS_ERROR,
    validate: validateDocxFile,
  });
  const dzJob = useDocxToolJob({
    process: generateMemorandum,
    outputName: buildMemorandumOutputName,
    fallbackError: 'Не удалось сгенерировать докладную записку. Проверьте подключение к API.',
    validate: validateDocxFile,
  });
  const azControlJob = useDocxToolJob({
    process: (file) => {
      const checkDate = toIsoDate(azControlDate);
      return generateControlFile(file, {
        checkLeader: azControlLeader,
        checkDate: checkDate ?? '',
      });
    },
    outputName: buildControlFileOutputName,
    fallbackError: 'Не удалось сформировать файл контроля. Проверьте подключение к API.',
    validate: validateDocxFile,
  });

  const handleDownloadControlTemplate = async () => {
    azControlJob.setError(null);
    setIsControlTemplateDownloading(true);
    try {
      const blob = await downloadControlFileTemplate();
      downloadBlob(blob, CONTROL_FILE_TEMPLATE_NAME);
    } catch (err) {
      azControlJob.setError(
        getErrorMessage(err, 'Не удалось скачать шаблон файла контроля. Проверьте подключение к API.'),
      );
    } finally {
      setIsControlTemplateDownloading(false);
    }
  };

  const handleGenerateControlFile = async () => {
    if (!azControlJob.file) {
      azControlJob.setError('Выберите файл .docx для обработки.');
      return;
    }
    if (!azControlLeader) {
      azControlJob.setError('Выберите руководителя проверки.');
      return;
    }
    if (!toIsoDate(azControlDate)) {
      azControlJob.setError('Выберите дату проверки.');
      return;
    }
    await azControlJob.run();
  };

  return (
    <div className={`w-full ${FORM_STACK_CLASS}`}>
      <PageHeader title="Инструменты аудита" />

      <div className="w-full space-y-3">
        <SegmentedControl value={activeTab} options={TOOL_TABS} onChange={setActiveTab} />

        {activeTab === 'az' && (
          <div className={TOOLS_SECTION_CLASS}>
            <div className={TOOLS_SECTION_TITLE_CLASS}>Парсинг</div>
            <div className="space-y-8">
              <DocxToolPanel
                title="1. Парсинг Раздела II Аудиторского Заключения"
                description="Загрузите Аудиторское Заключение в формате .docx без Раздела II, чтобы собрать таблицу с основными результатами аудита и аудиторскими рекомендациями."
                file={azJob.file}
                onFileChange={azJob.onFileChange}
                onProcess={() => void azJob.run()}
                isProcessing={azJob.isProcessing}
                error={azJob.error}
              />
              <DocxToolPanel
                title="2. Парсинг Раздела II Аудиторского Заключения (с гиперссылками)"
                description="То же, что в пункте 1, но название каждого наблюдения в таблице будет гиперссылкой на это наблюдение в тексте документа."
                file={azLinksJob.file}
                onFileChange={azLinksJob.onFileChange}
                onProcess={() => void azLinksJob.run()}
                isProcessing={azLinksJob.isProcessing}
                error={azLinksJob.error}
              />
              <DocxToolPanel
                title="3. Парсинг Аудиторского Заключения под форму файла контроля"
                description="Загрузите Аудиторское заключение с Разделом II, чтобы заполнить шаблон для файла контроля."
                file={azControlJob.file}
                onFileChange={azControlJob.onFileChange}
                onTemplateDownload={handleDownloadControlTemplate}
                isTemplateDownloading={isControlTemplateDownloading}
                onProcess={() => void handleGenerateControlFile()}
                isProcessing={azControlJob.isProcessing}
                isProcessDisabled={!azControlLeader || !azControlDate}
                extraFieldsClassName="w-full"
                hideTemplateButton
                error={azControlJob.error}
              >
                <div className="flex items-end gap-4">
                  <Select
                    label="Руководитель проверки"
                    value={azControlLeader}
                    onChange={setAzControlLeader}
                    options={controlLeaderOptions}
                    placeholder="Выберите руководителя"
                    className="w-[288px] shrink-0"
                    labelClassName={FORM_LABEL_CLASS}
                    inputClassName={FORM_INPUT_CLASS}
                  />
                  <DatePicker
                    label="Дата проверки"
                    selected={azControlDate}
                    onChange={setAzControlDate}
                    className="w-[288px] shrink-0"
                    labelClassName={FORM_LABEL_CLASS}
                    inputClassName={FORM_INPUT_CLASS}
                  />
                  <button
                    type="button"
                    onClick={() => void handleDownloadControlTemplate()}
                    disabled={isControlTemplateDownloading}
                    className="inline-flex h-[38px] w-[288px] shrink-0 items-center justify-center gap-2 rounded-lg border border-sber-light px-5 py-2.5 text-sm font-medium text-sber-light transition hover:bg-sber-light hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download size={18} />
                    {isControlTemplateDownloading ? 'Скачивание...' : 'Скачать шаблон'}
                  </button>
                </div>
              </DocxToolPanel>
            </div>
          </div>
        )}

        {activeTab === 'dz' && (
          <div className={TOOLS_SECTION_CLASS}>
            <div className={TOOLS_SECTION_TITLE_CLASS}>Парсинг</div>
            <DocxToolPanel
              title="1. Парсинг Приложения 2 к ДЗ"
              description="Загрузите Аудиторское Заключение в формате .docx с Разделом II, чтобы сгенерировать Приложение 2 к Докладной Записке."
              file={dzJob.file}
              onFileChange={dzJob.onFileChange}
              onProcess={() => void dzJob.run()}
              isProcessing={dzJob.isProcessing}
              error={dzJob.error}
            />
          </div>
        )}
      </div>
    </div>
  );
}
