type PageHeaderProps = {
  title: string;
};

export function PageHeader({ title }: PageHeaderProps) {
  return (
    <div className="space-y-1">
      <h2 className="text-2xl font-bold text-sber-dark text-left">{title}</h2>
    </div>
  );
}
