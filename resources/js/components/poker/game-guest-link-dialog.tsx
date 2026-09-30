import { useState } from 'react';
import { toast } from 'sonner';
import PokerGuestTokensController from '@/actions/App/Http/Controllers/Poker/PokerGuestTokensController';
import PokerSettingsController from '@/actions/App/Http/Controllers/Poker/PokerSettingsController';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function GameGuestLinkDialog({ open, onOpenChange }: Props) {
    const ctx = useGame();
    const { t } = useTrans();
    const { game } = ctx.snapshot;
    const [busy, setBusy] = useState(false);

    const toggle = async (enabled: boolean) => {
        setBusy(true);

        const result = await ctx.run(
            retroRequest(PokerSettingsController.update(game.id), {
                guest_access_enabled: enabled,
            }),
        );

        if (result !== undefined) {
            await ctx.refetch();
        }

        setBusy(false);
    };

    const regenerate = async () => {
        setBusy(true);

        const result = await ctx.run(
            retroRequest<{ guestUrl: string }>(
                PokerGuestTokensController.store(game.id),
            ),
        );

        if (result) {
            await ctx.refetch();
        }

        setBusy(false);
    };

    const copy = async () => {
        if (!game.guestUrl) {
            return;
        }

        try {
            await navigator.clipboard.writeText(game.guestUrl);
            toast(t('Link copied'));
        } catch {
            toast.error(t('Something went wrong. Please try again.'));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                <DialogTitle>{t('Guest link')}</DialogTitle>

                <div className="flex items-center gap-2">
                    <Checkbox
                        id="poker-guest-link-access"
                        checked={game.guestAccessEnabled}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                            void toggle(checked === true)
                        }
                    />
                    <Label htmlFor="poker-guest-link-access">
                        {t('Allow guests')}
                    </Label>
                </div>

                {game.guestAccessEnabled && game.guestUrl && (
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <Input
                                readOnly
                                value={game.guestUrl}
                                aria-label={t('Guest link')}
                                onFocus={(event) => event.target.select()}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void copy()}
                            >
                                {t('Copy')}
                            </Button>
                        </div>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void regenerate()}
                        >
                            {t('Create a new link')}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            {t(
                                'Creating a new link signs out every guest who joined with the old one.',
                            )}
                        </p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
