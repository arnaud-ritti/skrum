import { Plus } from 'lucide-react';
import { useState } from 'react';
import ColumnsController from '@/actions/App/Http/Controllers/Retros/ColumnsController';
import { ColumnColorOptions } from '@/components/skrum/column-color-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardColumn, ColumnColor } from '@/lib/retro/types';
import { useBoard } from './board-context';

const DefaultColor: ColumnColor = 'moss';

export function AddColumn() {
    const ctx = useBoard();
    const { t } = useTrans();
    const [title, setTitle] = useState('');
    const [color, setColor] = useState<ColumnColor>(DefaultColor);
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
            ctx.apply({ type: 'columns.set', columns: response.columns });
            setTitle('');
            setColor(DefaultColor);
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
                maxLength={100}
                required
                placeholder={t('Column title')}
                aria-label={t('Column title')}
                onChange={(event) => setTitle(event.target.value)}
            />
            <ColumnColorOptions
                value={color}
                onValueChange={setColor}
                columnTitle={title}
            />
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
