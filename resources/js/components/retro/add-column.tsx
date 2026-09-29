import { Plus } from 'lucide-react';
import { useState } from 'react';
import ColumnsController from '@/actions/App/Http/Controllers/Retros/ColumnsController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import {
    ColumnColors,
    columnColorLabel,
    columnSwatch,
} from '@/lib/retro/colors';
import type { BoardColumn, ColumnColor } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';

export function AddColumn() {
    const ctx = useBoard();
    const { t } = useTrans();
    const [title, setTitle] = useState('');
    const [color, setColor] = useState<ColumnColor>('green');
    const [sending, setSending] = useState(false);

    const submit = async () => {
        const trimmed = title.trim();

        if (trimmed === '' || sending) {
            return;
        }

        setSending(true);
        const response = await ctx.run(
            retroRequest<{ columns: BoardColumn[] }>(
                ColumnsController.store(ctx.board.retro.id),
                { title: trimmed, color },
            ),
        );
        setSending(false);

        if (response) {
            ctx.dispatch({ type: 'columns.set', columns: response.columns });
            setTitle('');
        }
    };

    return (
        <form
            className="w-72 shrink-0 space-y-3 rounded-lg border border-dashed p-3"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            <Input
                value={title}
                maxLength={60}
                required
                placeholder={t('Column title')}
                aria-label={t('Column title')}
                onChange={(event) => setTitle(event.target.value)}
            />
            <div
                role="radiogroup"
                aria-label={t('Color')}
                className="flex gap-2"
            >
                {ColumnColors.map((option) => (
                    <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={color === option}
                        aria-label={t(columnColorLabel[option])}
                        onClick={() => setColor(option)}
                        className={cn(
                            'size-6 rounded-full ring-offset-2 ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            columnSwatch[option],
                            color === option && 'ring-2 ring-foreground',
                        )}
                    />
                ))}
            </div>
            <Button
                type="submit"
                size="sm"
                disabled={sending || title.trim() === ''}
            >
                <Plus className="size-4" />
                {t('Add column')}
            </Button>
        </form>
    );
}
