type PageHeaderProps = {
  title: string;
  description?: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="space-y-1">
      <h2 className="text-2xl font-bold text-sber-dark text-left dark:text-sber-light">{title}</h2>
      {description && <p className="text-base text-gray-500 dark:text-slate-400">{description}</p>}
    </div>
  );
}
