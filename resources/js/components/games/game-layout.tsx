import { Shapes, Users } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useRestoreFocus } from '@/components/ui/use-restore-focus';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { useMinWidth } from './use-min-width';

export type GameLayoutProps = {
    /** The game choice; absent for who cannot choose. */
    left?: ReactNode;
    stage: ReactNode;
    /** Players, scores and what the game adds under them. */
    right: ReactNode;
    /** Stands for the right column above the stage of a phone. */
    summary?: ReactNode;
    /** Bottom centre of the stage, never over it: the reaction bar. */
    dock?: ReactNode;
    className?: string;
};

const RightColumnFromRem = 64;

/** False where the right column is a sheet: what a game needs at hand then stands on the stage. */
export function useHasRightColumn(): boolean {
    return useMinWidth(RightColumnFromRem);
}
const LeftColumnFromRem = 80;

type Panel = 'left' | 'right';

/** The three columns of a game, without a topbar: a room and the retro stage share it. */
export function GameLayout({
    left,
    stage,
    right,
    summary,
    dock,
    className,
}: GameLayoutProps) {
    const { t } = useTrans();
    const hasRightColumn = useMinWidth(RightColumnFromRem);
    const isWide = useMinWidth(LeftColumnFromRem);
    const [panel, setPanel] = useState<Panel>('right');
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const restoreFocus = useRestoreFocus(isPanelOpen);

    const open = (next: Panel) => {
        setPanel(next);
        setIsPanelOpen(true);
    };

    const hasLeft = left !== undefined && left !== null;
    const hasLeftColumn = hasLeft && isWide;
    const leftInSheet = hasLeft && !isWide;
    const rightInSheet = !hasRightColumn;
    const isSheetOpen =
        isPanelOpen &&
        ((panel === 'left' && leftInSheet) ||
            (panel === 'right' && rightInSheet));

    return (
        <div
            data-slot="game-layout"
            className={cn(
                'grid h-full min-h-0 grid-cols-1',
                hasRightColumn &&
                    !hasLeftColumn &&
                    'grid-cols-[minmax(0,1fr)_20rem]',
                hasLeftColumn && 'grid-cols-[21.25rem_minmax(0,1fr)_20rem]',
                className,
            )}
        >
            {hasLeftColumn && (
                <aside
                    data-slot="game-left"
                    aria-label={t('Choose a game')}
                    className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto border-r bg-card p-5"
                >
                    {left}
                </aside>
            )}
            <div
                data-slot="game-stage"
                className="flex min-h-0 min-w-0 flex-col bg-skrum-canvas"
            >
                {(leftInSheet || rightInSheet) && (
                    <div
                        data-slot="game-bar"
                        className="flex shrink-0 items-center gap-2 border-b bg-background px-4 py-2"
                    >
                        <div className="min-w-0 flex-1">
                            {rightInSheet && summary}
                        </div>
                        {rightInSheet && (
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                aria-label={t('Players and scores')}
                                onClick={() => open('right')}
                            >
                                <Users aria-hidden />
                            </Button>
                        )}
                        {leftInSheet && (
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                aria-label={t('Choose a game')}
                                onClick={() => open('left')}
                            >
                                <Shapes aria-hidden />
                            </Button>
                        )}
                    </div>
                )}
                <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-5 sm:px-8">
                    {stage}
                </div>
                {dock !== undefined && dock !== null && (
                    <div
                        data-slot="game-dock"
                        className="flex shrink-0 justify-center px-2 pb-3"
                    >
                        {dock}
                    </div>
                )}
            </div>
            {hasRightColumn && (
                <aside
                    data-slot="game-right"
                    aria-label={t('Players and scores')}
                    className="flex min-h-0 min-w-0 flex-col gap-5 overflow-y-auto border-l bg-card p-5"
                >
                    {right}
                </aside>
            )}
            <Sheet
                open={isSheetOpen}
                onOpenChange={(next) => {
                    if (!next) {
                        setIsPanelOpen(false);
                    }
                }}
            >
                <SheetContent
                    side={panel}
                    aria-describedby={undefined}
                    onCloseAutoFocus={restoreFocus}
                >
                    <SheetHeader>
                        <SheetTitle>
                            {panel === 'left'
                                ? t('Choose a game')
                                : t('Players and scores')}
                        </SheetTitle>
                    </SheetHeader>
                    <SheetBody className="flex flex-col gap-5 space-y-0">
                        {panel === 'left' ? left : right}
                    </SheetBody>
                </SheetContent>
            </Sheet>
        </div>
    );
}
