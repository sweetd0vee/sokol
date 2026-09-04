export function FormValidationBanner({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }
  return (
    <div className="rounded-lg border border-[#e8b4b4] bg-[#fff3f3] px-4 py-2 text-sm font-medium leading-relaxed text-[#a63d3d]">
      Заполните необходимые поля
    </div>
  );
}
