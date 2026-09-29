import { useState } from 'react';
import { toast } from 'sonner';
import RetroGuestTokensController from '@/actions/App/Http/Controllers/Retros/RetroGuestTokensController';
import RetroSettingsController from '@/actions/App/Http/Controllers/Retros/RetroSettingsController';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardContextValue } from './board';

type Props = {
    ctx: BoardContextValue;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function GuestLinkDialog({ ctx, open, onOpenChange }: Props) {
    const { t } = useTrans();
    const { retro } = ctx.board;
    const [busy, setBusy] = useState(false);

    const toggle = async (enabled: boolean) => {
        setBusy(true);

        const result = await ctx.run(
            retroRequest(RetroSettingsController.update(retro.id), {
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
                RetroGuestTokensController.store(retro.id),
            ),
        );

        if (result) {
            await ctx.refetch();
        }

        setBusy(false);
    };

    const copy = async () => {
        if (!retro.guestUrl) {
            return;
        }

        try {
            await navigator.clipboard.writeText(retro.guestUrl);
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
                        id="guest-access"
                        checked={retro.guestAccessEnabled}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                            void toggle(checked === true)
                        }
                    />
                    <Label htmlFor="guest-access">{t('Allow guests')}</Label>
                </div>

                {retro.guestAccessEnabled && retro.guestUrl && (
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <Input
                                readOnly
                                value={retro.guestUrl}
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
