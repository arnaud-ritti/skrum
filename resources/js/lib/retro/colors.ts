import type { ColumnColor } from './types';

export const columnAccent: Record<ColumnColor, string> = {
    green: 'border-t-emerald-500',
    red: 'border-t-rose-500',
    blue: 'border-t-sky-500',
    amber: 'border-t-amber-500',
    purple: 'border-t-violet-500',
    slate: 'border-t-slate-500',
};

export const ColumnColors: ColumnColor[] = [
    'green',
    'red',
    'blue',
    'amber',
    'purple',
    'slate',
];
