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

const TOOLS_SECTION_CLASS =`${FORM_SECTION_CLASS} w-full border-0`;
const TOOLS_SECTION_TITLE_CLASS =`${FORM_SECTION_TITLE_CLASS}`;

const buildSectionIIOutputName = (name: string, withHyperlinks = false) =>
`${name.replace(/\.docx$/i, '')}${withHyperlinks ? '_section_ii_links' : '_section_ii'}.docx`;
const buildMemorandumOutputName = (name: string) =>`${name.replace(/\.docx$/i, '')}_dz.docx`;
const buildControlFileOutputName = (name: string) =>`${name.replace(/\.docx$/i, '')}_control.xlsx`;
const CONTROL_FILE_TEMPLATE_NAME = 'файл контроля шаблон (шапка).xlsx';

export function ToolsTab() {
  const [activeTab, setActiveTab] = useState<'az' | 'dz'>('az');
  const [azFile, setAzFile] = useState<File | null>(null);
  const [azLinksFile, setAzLinksFile] = useState<File | null>(null);
  const [azControlFile, setAzControlFile] = useState<File | null>(null);
  const [azControlLeader, setAzControlLeader] = useState('');
  const [azControlDate, setAzControlDate] = useState<Date | null>(null);
  const [dzFile, setDzFile] = useState<File | null>(null);
  const [azError, setAzError] = useState<string | null>(null);
  const [azLinksError, setAzLinksError] = useState<string | null>(null);
  const [azControlError, setAzControlError] = useState<string | null>(null);
  const [dzError, setDzError] = useState<string | null>(null);
  const [isAzProcessing, setIsAzProcessing] = useState(false);
  const [isAzLinksProcessing, setIsAzLinksProcessing] = useState(false);
  const [isAzControlProcessing, setIsAzControlProcessing] = useState(false);
  const [isControlTemplateDownloading, setIsControlTemplateDownloading] = useState(false);
  const [isDzProcessing, setIsDzProcessing] = useState(false);
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

  const handleAzFileChange = (file: File | null) => {
    setAzError(null);
    const validationError = validateDocxFile(file);
    if (validationError) {
      setAzFile(null);
      setAzError(validationError);
      return;
    }
    setAzFile(file);
  };

  const handleAzLinksFileChange = (file: File | null) => {
    setAzLinksError(null);
    const validationError = validateDocxFile(file);
    if (validationError) {
      setAzLinksFile(null);
      setAzLinksError(validationError);
      return;
    }
    setAzLinksFile(file);
  };

  const handleDzFileChange = (file: File | null) => {
    setDzError(null);
    const validationError = validateDocxFile(file);
    if (validationError) {
      setDzFile(null);
      setDzError(validationError);
      return;
    }
    setDzFile(file);
  };

  const handleAzControlFileChange = (file: File | null) => {
    setAzControlError(null);
    const validationError = validateDocxFile(file);
    if (validationError) {
      setAzControlFile(null);
      setAzControlError(validationError);
      return;
    }
    setAzControlFile(file);
  };

  const handleGenerateSectionII = async () => {
    if (!azFile) {
      setAzError('Выберите файл .docx для обработки.');
      return;
    }
    setAzError(null);
    setIsAzProcessing(true);
    try {
      const blob = await generateSectionIITemplate(azFile);
      downloadBlob(blob, buildSectionIIOutputName(azFile.name));
    } catch (err) {
      setAzError(getErrorMessage(err, 'Не удалось обработать файл. Проверьте подключение к API.'));
    } finally {
      setIsAzProcessing(false);
    }
  };

  const handleGenerateSectionIIWithLinks = async () => {
    if (!azLinksFile) {
      setAzLinksError('Выберите файл .docx для обработки.');
      return;
    }
    setAzLinksError(null);
    setIsAzLinksProcessing(true);
    try {
      const blob = await generateSectionIIWithLinks(azLinksFile);
      downloadBlob(blob, buildSectionIIOutputName(azLinksFile.name, true));
    } catch (err) {
      setAzLinksError(
        getErrorMessage(err, 'Не удалось обработать файл. Проверьте подключение к API.'),
      );
    } finally {
      setIsAzLinksProcessing(false);
    }
  };

  const handleGenerateMemorandum = async () => {
    if (!dzFile) {
      setDzError('Выберите файл .docx для обработки.');
      return;
    }
    setDzError(null);
    setIsDzProcessing(true);
    try {
      const blob = await generateMemorandum(dzFile);
      downloadBlob(blob, buildMemorandumOutputName(dzFile.name));
    } catch (err) {
      setDzError(getErrorMessage(err, 'Не удалось сгенерировать докладную записку. Проверьте подключение к API.'));
    } finally {
      setIsDzProcessing(false);
    }
  };

  const handleDownloadControlTemplate = async () => {
    setAzControlError(null);
    setIsControlTemplateDownloading(true);
    try {
      const blob = await downloadControlFileTemplate();
      downloadBlob(blob, CONTROL_FILE_TEMPLATE_NAME);
    } catch (err) {
      setAzControlError(
        getErrorMessage(err, 'Не удалось скачать шаблон файла контроля. Проверьте подключение к API.'),
      );
    } finally {
      setIsControlTemplateDownloading(false);
    }
  };

  const handleGenerateControlFile = async () => {
    if (!azControlFile) {
      setAzControlError('Выберите файл .docx для обработки.');
      return;
    }
    if (!azControlLeader) {
      setAzControlError('Выберите руководителя проверки.');
      return;
    }
    const checkDate = toIsoDate(azControlDate);
    if (!checkDate) {
      setAzControlError('Выберите дату проверки.');
      return;
    }
    setAzControlError(null);
    setIsAzControlProcessing(true);
    try {
      const blob = await generateControlFile(azControlFile, {
        checkLeader: azControlLeader,
        checkDate,
      });
      downloadBlob(blob, buildControlFileOutputName(azControlFile.name));
    } catch (err) {
      setAzControlError(
        getErrorMessage(err, 'Не удалось сформировать файл контроля. Проверьте подключение к API.'),
      );
    } finally {
      setIsAzControlProcessing(false);
    }
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
                file={azFile}
                onFileChange={handleAzFileChange}
                onProcess={handleGenerateSectionII}
                isProcessing={isAzProcessing}
                error={azError}
              />
              <DocxToolPanel
                title="2. Парсинг Раздела II Аудиторского Заключения (с гиперссылками)"
                description="То же, что в пункте 1, но название каждого наблюдения в таблице будет гиперссылкой на это наблюдение в тексте документа."
                file={azLinksFile}
                onFileChange={handleAzLinksFileChange}
                onProcess={handleGenerateSectionIIWithLinks}
                isProcessing={isAzLinksProcessing}
                error={azLinksError}
              />
              <DocxToolPanel
                title="3. Парсинг Аудиторского Заключения под форму файла контроля"
                description="Загрузите Аудиторское заключение с Разделом II, чтобы заполнить шаблон для файла контроля."
                file={azControlFile}
                onFileChange={handleAzControlFileChange}
                onTemplateDownload={handleDownloadControlTemplate}
                isTemplateDownloading={isControlTemplateDownloading}
                onProcess={handleGenerateControlFile}
                isProcessing={isAzControlProcessing}
                isProcessDisabled={!azControlLeader || !azControlDate}
                extraFieldsClassName="w-full max-w-[288px]"
                hideTemplateButton
                error={azControlError}
              >
                <div className="flex flex-wrap items-end gap-4">
                  <Select
                    label="Руководитель проверки"
                    value={azControlLeader}
                    onChange={setAzControlLeader}
                    options={controlLeaderOptions}
                    placeholder="Выберите руководителя"
                    className="min-w-0 w-full"
                    labelClassName={FORM_LABEL_CLASS}
                    inputClassName={FORM_INPUT_CLASS}
                  />
                  <DatePicker
                    label="Дата проверки"
                    selected={azControlDate}
                    onChange={setAzControlDate}
                    className="min-w-0 w-full"
                    labelClassName={FORM_LABEL_CLASS}
                    inputClassName={FORM_INPUT_CLASS}
                  />
                  <button
                    type="button"
                    onClick={handleDownloadControlTemplate}
                    disabled={isControlTemplateDownloading}
                    className="inline-flex h-[38px] w-full items-center justify-center gap-2 rounded-lg border border-sber-light px-5 py-2.5 text-sm font-medium text-sber-light transition hover:bg-sber-light hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
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
              file={dzFile}
              onFileChange={handleDzFileChange}
              onProcess={handleGenerateMemorandum}
              isProcessing={isDzProcessing}
              error={dzError}
            />
          </div>
        )}
      </div>
    </div>
  );
}
