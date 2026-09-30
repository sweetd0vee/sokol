import { lazy, type ComponentType } from 'react';

export function lazyNamed(loader: () => Promise<Record<string, unknown>>, exportName: string) {
  return lazy(async () => {
    const module = await loader();
    const Page = module[exportName];
    if (typeof Page !== 'function') {
      throw new Error(`Не найден экспорт «${exportName}»`);
    }
    return { default: Page as ComponentType };
  });
}
