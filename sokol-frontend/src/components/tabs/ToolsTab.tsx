import { useCallback, useState } from 'react';
import { PageHeader } from '../ui/PageHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { DocxToolPanel } from '../tools/DocxToolPanel';
import { AuditOpinionPanel } from '../tools/AuditOpinionPanel';
import {
  generateAuditOpinion,
  generateMemorandum,
  generateSectionIITemplate,
  generateSectionIIWithLinks,
} from '../../api/tools';
import { getErrorMessage } from '../../api/errors';
import { downloadBlob } from '../../utils/download';
import { isDocxFile } from '../../utils/docx';
import {
  FORM_SECTION_CLASS,
  FORM_SECTION_TITLE_CLASS,
  FORM_STACK_CLASS,
} from '../../constants/formLayout';

const TOOL_TABS = [
  { value: 'az' as const, label: 'АЗ' },
  { value: 'dz' as const, label: 'ДЗ' },
];

const TOOLS_SECTION_CLASS = `${FORM_SECTION_CLASS} w-full dark:border-slate-600 dark:bg-slate-800/60`;
const TOOLS_SECTION_TITLE_CLASS = `${FORM_SECTION_TITLE_CLASS} dark:text-slate-100`;

const buildSectionIIOutputName = (name: string, withHyperlinks = false) =>
  `${name.replace(/\.docx$/i, '')}${withHyperlinks ? '_section_ii_links' : '_section_ii'}.docx`;
const buildMemorandumOutputName = (name: string) => `${name.replace(/\.docx$/i, '')}_dz.docx`;
const buildAuditOpinionOutputName = (name: string) => `${name.replace(/\.docx$/i, '')}_section_i.docx`;

export function ToolsTab() {
  const [activeTab, setActiveTab] = useState<'az' | 'dz'>('az');
  const [azFile, setAzFile] = useState<File | null>(null);
  const [azLinksFile, setAzLinksFile] = useState<File | null>(null);
  const [azOpinionFile, setAzOpinionFile] = useState<File | null>(null);
  const [azOpinionPrompt, setAzOpinionPrompt] = useState('');
  const [azOpinionModel, setAzOpinionModel] = useState('');
  const [dzFile, setDzFile] = useState<File | null>(null);
  const [azError, setAzError] = useState<string | null>(null);
  const [azLinksError, setAzLinksError] = useState<string | null>(null);
  const [azOpinionError, setAzOpinionError] = useState<string | null>(null);
  const [dzError, setDzError] = useState<string | null>(null);
  const [isAzProcessing, setIsAzProcessing] = useState(false);
  const [isAzLinksProcessing, setIsAzLinksProcessing] = useState(false);
  const [isAzOpinionProcessing, setIsAzOpinionProcessing] = useState(false);
  const [isDzProcessing, setIsDzProcessing] = useState(false);

  const handleAzOpinionPromptChange = useCallback((value: string) => {
    setAzOpinionPrompt(value);
  }, []);

  const handleAzOpinionModelChange = useCallback((value: string) => {
    setAzOpinionModel(value);
  }, []);

  const handleAzFileChange = (file: File | null) => {
    setAzError(null);
    if (file && !isDocxFile(file)) {
      setAzFile(null);
      setAzError('Файл должен быть в формате .docx.');
      return;
    }
    setAzFile(file);
  };

  const handleAzLinksFileChange = (file: File | null) => {
    setAzLinksError(null);
    if (file && !isDocxFile(file)) {
      setAzLinksFile(null);
      setAzLinksError('Файл должен быть в формате .docx.');
      return;
    }
    setAzLinksFile(file);
  };

  const handleAzOpinionFileChange = (file: File | null) => {
    setAzOpinionError(null);
    if (file && !isDocxFile(file)) {
      setAzOpinionFile(null);
      setAzOpinionError('Файл должен быть в формате .docx.');
      return;
    }
    setAzOpinionFile(file);
  };

  const handleDzFileChange = (file: File | null) => {
    setDzError(null);
    if (file && !isDocxFile(file)) {
      setDzFile(null);
      setDzError('Файл должен быть в формате .docx.');
      return;
    }
    setDzFile(file);
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

  const handleGenerateAuditOpinion = async () => {
    if (!azOpinionFile) {
      setAzOpinionError('Выберите файл .docx для обработки.');
      return;
    }
    if (!azOpinionPrompt.trim()) {
      setAzOpinionError('Заполните промпт для модели.');
      return;
    }
    if (!azOpinionModel.trim()) {
      setAzOpinionError('Выберите модель в настройках (шестерёнка).');
      return;
    }
    setAzOpinionError(null);
    setIsAzOpinionProcessing(true);
    try {
      const blob = await generateAuditOpinion(azOpinionFile, azOpinionPrompt, azOpinionModel);
      downloadBlob(blob, buildAuditOpinionOutputName(azOpinionFile.name));
    } catch (err) {
      setAzOpinionError(
        getErrorMessage(
          err,
          'Не удалось сгенерировать аудиторское мнение. Проверьте API и сервис Ollama.',
        ),
      );
    } finally {
      setIsAzOpinionProcessing(false);
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

  return (
    <div className={`w-full ${FORM_STACK_CLASS}`}>
      <PageHeader title="Инструменты аудита" />

      <div className="w-full space-y-8">
        <SegmentedControl value={activeTab} options={TOOL_TABS} onChange={setActiveTab} />

        {activeTab === 'az' && (
          <div className="w-full space-y-8">
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
              </div>
            </div>

            <div className={TOOLS_SECTION_CLASS}>
              <div className={TOOLS_SECTION_TITLE_CLASS}>Генерация</div>
              <AuditOpinionPanel
                title="1. Генерация аудиторского мнения"
                description="Загрузите Аудиторское Заключение в формате .docx без заполненного Раздела I (заголовок «I. Аудиторское мнение по итогам проверки» должен быть). Модель Ollama подготовит саммари по наблюдениям и рекомендациям на 2–3 страницы и вставит текст в Раздел I с жёлтой подсветкой."
                file={azOpinionFile}
                onFileChange={handleAzOpinionFileChange}
                prompt={azOpinionPrompt}
                onPromptChange={handleAzOpinionPromptChange}
                model={azOpinionModel}
                onModelChange={handleAzOpinionModelChange}
                onProcess={handleGenerateAuditOpinion}
                isProcessing={isAzOpinionProcessing}
                error={azOpinionError}
              />
            </div>
          </div>
        )}

        {activeTab === 'dz' && (
          <div className={TOOLS_SECTION_CLASS}>
            <div className={TOOLS_SECTION_TITLE_CLASS}>Генерация</div>
            <DocxToolPanel
              title="1. Генерация Докладной Записки"
              description="Загрузите Аудиторское Заключение в формате .docx с Разделом II, чтобы сгенерировать Докладную Записку."
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
