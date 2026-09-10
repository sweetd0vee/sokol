export function EmptyChart({ message, heightClass = 'h-24' }: { message: string; heightClass?: string }) {
  return (
    <div
      className={`flex ${heightClass} items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-500`}
    >
      {message}
    </div>
  );
}
