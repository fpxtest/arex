import React from 'react';

export type ArexPane<D extends PanesData = PanesData> = ArexPaneFC<D> & {
  icon?: React.ReactNode;
  type: string;
  menuType?: string;
};

export type ArexPaneFC<D extends PanesData = PanesData> = React.FC<{ data: D }>;

export type PanesData = any;

export function createArexPane<D extends PanesData>(
  Pane: ArexPaneFC<D>,
  options: {
    type: string;
    menuType?: string;
    icon?: React.ReactNode;
  },
): ArexPane<D> {
  const { type, menuType, icon } = options;
  return Object.assign(Pane, {
    type,
    menuType,
    icon,
  });
}