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

export const columnSwatch: Record<ColumnColor, string> = {
    green: 'bg-emerald-500',
    red: 'bg-rose-500',
    blue: 'bg-sky-500',
    amber: 'bg-amber-500',
    purple: 'bg-violet-500',
    slate: 'bg-slate-500',
};

export const columnColorLabel: Record<ColumnColor, string> = {
    green: 'Green',
    red: 'Red',
    blue: 'Blue',
    amber: 'Amber',
    purple: 'Purple',
    slate: 'Slate',
};
