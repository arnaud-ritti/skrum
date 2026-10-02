import { Link } from '@inertiajs/react';
import { Lock } from 'lucide-react';
import type { ComponentProps, ReactElement } from 'react';
import { SettingsCard } from '@/components/settings/settings-card';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

/**
 * Stands for settings the server keeps until the password is confirmed: it
 * says what is behind, and its button leads to the confirmation, which leads
 * back to the section.
 */
export function LockedSettingsCard({
    title,
    description,
    href,
}: {
    title: string;
    description: string;
    /** An address that asks for the password, then comes back to the section. */
    href: ComponentProps<typeof Link>['href'];
}): ReactElement {
    const { t } = useTrans();

    return (
        <SettingsCard title={title} description={description}>
            <div
                data-slot="locked-settings"
                className="flex min-w-0 flex-wrap items-center gap-3"
            >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Lock aria-hidden="true" className="size-5" />
                </span>
                <span className="min-w-0 flex-1 basis-40 text-sm font-semibold">
                    {t('Locked')}
                </span>
                <Button asChild size="sm">
                    <Link href={href}>
                        <span className="truncate">
                            {t('Confirm password')}
                        </span>
                    </Link>
                </Button>
            </div>
        </SettingsCard>
    );
}
