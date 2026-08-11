import { FileCheck, ExternalLink } from 'lucide-react';

export function KantslerTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-sber-dark text-left">Канцлер</h2>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-8">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-sber-dark/10">
            <FileCheck className="w-10 h-10 text-sber-dark" />
          </div>
          <div className="flex-1">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Интеграция с СЭД Канцлер</h3>
            <p className="mb-4 text-gray-600">
              Здесь будет реализована интеграция с программой СЭД Канцлер — система электронного документооборота.
              Планируется обмен документами, синхронизация поручений и рекомендаций между Сокол и Канцлер.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sber-dark/10 text-sber-dark text-sm font-medium">
                <ExternalLink size={14} />
                В разработке
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h4 className="mb-2 font-medium text-gray-900">Планируемый функционал</h4>
          <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
            <li>Подключение к API СЭД Канцлер</li>
            <li>Импорт поручений из Канцлер</li>
            <li>Экспорт рекомендаций в Канцлер</li>
            <li>Синхронизация статусов документов</li>
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h4 className="mb-2 font-medium text-gray-900">Настройки подключения</h4>
          <p className="text-sm text-gray-500">
            URL сервера Канцлер, учётные данные и параметры интеграции будут настраиваться здесь после реализации.
          </p>
        </div>
      </div>
    </div>
  );
}
