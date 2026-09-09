import type { ComponentType } from 'react';
import * as ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

type GridLayoutModule = {
  default?: ComponentType<Record<string, unknown>>;
};

const gridLayoutModule = ReactGridLayout as unknown as GridLayoutModule;

export const BaseGridLayout = (
  gridLayoutModule.default ?? ReactGridLayout
) as ComponentType<Record<string, unknown>>;
