import { Eraser, PaintBucket, Pencil, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { colorCss, DrawingColors, DrawingSizes } from '@/lib/games/drawing';
import type { DrawingColor, DrawingSize } from '@/lib/games/types';
import { cn } from '@/lib/utils';
import type { CanvasTool } from './drawing-canvas';

const ConfirmClearMs = 3000;

type Props = {
    tool: CanvasTool;
    color: DrawingColor;
    size: DrawingSize;
    canUndo: boolean;
    onTool: (tool: CanvasTool) => void;
    onColor: (color: DrawingColor) => void;
    onSize: (size: DrawingSize) => void;
    onUndo: () => void;
    onClear: () => void;
};

export function DrawingToolbar({
    tool,
    color,
    size,
    canUndo,
    onTool,
    onColor,
    onSize,
    onUndo,
    onClear,
}: Props) {
    const { t } = useTrans();
    const [confirmingClear, setConfirmingClear] = useState(false);

    useEffect(() => {
        if (!confirmingClear) {
            return;
        }

        const timeout = window.setTimeout(
            () => setConfirmingClear(false),
            ConfirmClearMs,
        );

        return () => window.clearTimeout(timeout);
    }, [confirmingClear]);

    const colorNames: Record<DrawingColor, string> = {
        black: t('Black'),
        red: t('Red'),
        orange: t('Orange'),
        green: t('Green'),
        blue: t('Blue'),
        purple: t('Purple'),
        white: t('White'),
    };

    const tools: { value: CanvasTool; label: string; Icon: typeof Pencil }[] = [
        { value: 'pen', label: t('Pen'), Icon: Pencil },
        { value: 'eraser', label: t('Eraser'), Icon: Eraser },
        { value: 'fill', label: t('Fill'), Icon: PaintBucket },
    ];

    return (
        <div
            role="toolbar"
            aria-label={t('Drawing tools')}
            className="flex flex-wrap items-center gap-3"
        >
            <div className="flex items-center gap-1.5">
                {DrawingColors.map((option) => (
                    <button
                        key={option}
                        type="button"
                        aria-label={colorNames[option]}
                        aria-pressed={color === option}
                        className={cn(
                            'size-7 rounded-full border-2 border-transparent ring-offset-2 ring-offset-background',
                            color === option && 'ring-2 ring-ring',
                        )}
                        style={{ backgroundColor: colorCss(option) }}
                        onClick={() => {
                            onColor(option);

                            if (tool === 'eraser') {
                                onTool('pen');
                            }
                        }}
                    />
                ))}
            </div>
            <div className="flex items-center gap-1">
                {DrawingSizes.map((option) => (
                    <button
                        key={option}
                        type="button"
                        aria-label={t('Size :size', { size: option })}
                        aria-pressed={size === option}
                        className={cn(
                            'flex size-8 items-center justify-center rounded-md hover:bg-muted',
                            size === option && 'bg-muted',
                        )}
                        onClick={() => onSize(option)}
                    >
                        <span
                            className="rounded-full bg-foreground"
                            style={{
                                width: Math.max(4, option * 0.8),
                                height: Math.max(4, option * 0.8),
                            }}
                        />
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-1">
                {tools.map(({ value, label, Icon }) => (
                    <Button
                        key={value}
                        type="button"
                        size="icon"
                        variant={tool === value ? 'secondary' : 'ghost'}
                        aria-label={label}
                        aria-pressed={tool === value}
                        onClick={() => onTool(value)}
                    >
                        <Icon className="size-4" />
                    </Button>
                ))}
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t('Undo')}
                    disabled={!canUndo}
                    onClick={onUndo}
                >
                    <Undo2 className="size-4" />
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={confirmingClear ? 'destructive' : 'ghost'}
                    disabled={!canUndo}
                    onClick={() => {
                        if (!confirmingClear) {
                            setConfirmingClear(true);

                            return;
                        }

                        setConfirmingClear(false);
                        onClear();
                    }}
                >
                    <Trash2 className="size-4" />
                    {confirmingClear ? t('Click again to clear') : t('Clear')}
                </Button>
            </div>
        </div>
    );
}
