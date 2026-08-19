import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LIST_PAGE_SIZE_OPTIONS } from '../../utils/listTable';

type ListPaginationProps = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  rangeLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function ListPagination({
  currentPage,
  totalPages,
  pageSize,
  rangeLabel,
  onPageChange,
  onPageSizeChange,
}: ListPaginationProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="whitespace-nowrap text-sm text-gray-600">{rangeLabel}</span>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Строк на странице:</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20"
        >
          {LIST_PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          aria-label="Предыдущая страница"
          title="Предыдущая страница"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-sber-dark transition hover:bg-sber-dark/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm text-gray-700">
          Страница {currentPage} из {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          aria-label="Следующая страница"
          title="Следующая страница"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-sber-dark transition hover:bg-sber-dark/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
