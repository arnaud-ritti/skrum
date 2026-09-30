import { Link } from '@inertiajs/react';
import { ArrowLeft, MousePointer2, MousePointerBan } from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import PokerSettingsController from '@/actions/App/Http/Controllers/Poker/PokerSettingsController';
import { LanguageSwitcher } from '@/components/language-switcher';
import { PresenceStrip } from '@/components/retro/presence-strip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { showsPokerCursors } from './game-cursors';
import { useGame } from './game-context';
import { GameMenu } from './game-menu';
import { TakeControlButton } from './take-control-button';

type Props = {
    actions?: ReactNode;
    hideMyCursor?: boolean;
    onHideMyCursorChange?: (hidden: boolean) => void;
};

export function GameHeader({
    actions,
    hideMyCursor,
    onHideMyCursorChange,
}: Props) {
    const { snapshot, online } = useGame();
    const { t } = useTrans();
    const { game, me, links } = snapshot;
    const isEnded = game.endedAt !== null;

    return (
        <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            {links.team && (
                <Link
                    href={links.team}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t('Back to the team')}
                >
                    <ArrowLeft className="size-5" />
                </Link>
            )}
            {me.isFacilitator && !isEnded ? (
                <TitleEditor key={game.title} />
            ) : (
                <h1 className="text-lg font-semibold">{game.title}</h1>
            )}
            <Badge variant="outline">{game.deckLabel}</Badge>
            {isEnded && <Badge variant="secondary">{t('Game ended')}</Badge>}
            <div className="ml-auto flex flex-wrap items-center gap-3">
                {actions}
                <TakeControlButton />
                {(me.isFacilitator || me.canDelete) && <GameMenu />}
                <PresenceStrip members={online} />
                {hideMyCursor !== undefined &&
                    onHideMyCursorChange &&
                    showsPokerCursors(snapshot) && (
                        <Button
                            size="icon"
                            variant="ghost"
                            aria-pressed={hideMyCursor}
                            aria-label={
                                hideMyCursor
                                    ? t('Show my cursor')
                                    : t('Hide my cursor')
                            }
                            onClick={() => onHideMyCursorChange(!hideMyCursor)}
                        >
                            {hideMyCursor ? (
                                <MousePointerBan className="size-4" />
                            ) : (
                                <MousePointer2 className="size-4" />
                            )}
                        </Button>
                    )}
                {me.isGuest && <LanguageSwitcher />}
            </div>
        </header>
    );
}

function TitleEditor() {
    const { snapshot, run, refetch } = useGame();
    const { t } = useTrans();
    const [value, setValue] = useState(snapshot.game.title);
    const isCancelled = useRef(false);

    const save = async () => {
        if (isCancelled.current) {
            isCancelled.current = false;
            setValue(snapshot.game.title);

            return;
        }

        const title = value.trim();

        if (title === '' || title === snapshot.game.title) {
            setValue(snapshot.game.title);

            return;
        }

        const result = await run(
            retroRequest(PokerSettingsController.update(snapshot.game.id), {
                title,
            }),
        );

        if (result !== undefined) {
            await refetch();
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.currentTarget.blur();
        }

        if (event.key === 'Escape') {
            isCancelled.current = true;
            event.currentTarget.blur();
        }
    };

    return (
        <h1 className="min-w-0">
            <Input
                value={value}
                maxLength={120}
                aria-label={t('Game title')}
                className="h-8 w-64 max-w-full border-transparent text-lg font-semibold shadow-none hover:border-input"
                onChange={(event) => setValue(event.target.value)}
                onBlur={() => void save()}
                onKeyDown={onKeyDown}
            />
        </h1>
    );
}
