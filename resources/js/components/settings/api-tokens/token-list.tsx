import { usePage } from '@inertiajs/react';
import { Eye, KeyRound } from 'lucide-react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { usePasswordGate } from '@/components/settings/password-gate';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { tokenDateFormatter } from '@/lib/api-tokens';
import type { ApiToken } from '@/types';
import { RevokeTokenDialog } from './revoke-token-dialog';
import { TokenCards } from './token-cards';
import { TokensTable } from './tokens-table';

type TokenListProps = {
    /** Absent while the password is not confirmed: the server keeps the list back. */
    tokens: ApiToken[] | null;
    newTokenName?: string;
};

/**
 * The card under the creation form. Its width decides between the table and
 * the cards, so both are in the page and one of them is not displayed.
 */
export function TokenList({
    tokens,
    newTokenName,
}: TokenListProps): ReactElement {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const { guard } = usePasswordGate();
    const [revoking, setRevoking] = useState(false);
    const [target, setTarget] = useState<ApiToken | null>(null);
    const formatDate = tokenDateFormatter(locale, t('Never'));

    const askToRevoke = (token: ApiToken): void =>
        guard(() => {
            setTarget(token);
            setRevoking(true);
        });

    if (tokens === null) {
        return (
            <Card data-slot="token-list" className="min-w-0">
                <div
                    data-slot="token-list-concealed"
                    className="flex flex-col items-center gap-3 px-5 py-8 text-center"
                >
                    <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                        <KeyRound aria-hidden="true" className="size-5" />
                    </span>
                    <p className="text-sm text-muted-foreground">
                        {t("Confirm it's you to see your tokens.")}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-w-full"
                        onClick={() => guard(() => undefined)}
                    >
                        <Eye aria-hidden="true" />
                        <span className="truncate">{t('Show my tokens')}</span>
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <Card data-slot="token-list" className="@container/tokens min-w-0">
            {tokens.length === 0 ? (
                <div
                    data-slot="token-list-empty"
                    className="flex flex-col items-center gap-3 px-5 py-8 text-center"
                >
                    <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                        <KeyRound aria-hidden="true" className="size-5" />
                    </span>
                    <p className="text-sm text-muted-foreground">
                        {t('No API tokens yet.')}
                    </p>
                </div>
            ) : (
                <>
                    <div
                        data-slot="token-list-table"
                        className="hidden @2xl/tokens:block"
                    >
                        <TokensTable
                            tokens={tokens}
                            formatDate={formatDate}
                            newTokenName={newTokenName}
                            onRevoke={askToRevoke}
                        />
                    </div>
                    <div
                        data-slot="token-list-cards"
                        className="@2xl/tokens:hidden"
                    >
                        <TokenCards
                            tokens={tokens}
                            formatDate={formatDate}
                            newTokenName={newTokenName}
                            onRevoke={askToRevoke}
                        />
                    </div>
                </>
            )}

            <RevokeTokenDialog
                token={target}
                open={revoking}
                onOpenChange={setRevoking}
            />
        </Card>
    );
}
