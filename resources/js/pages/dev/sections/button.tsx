import { ArrowRight, Plus, Settings2, Share2, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'ui';

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2">
            <p className="text-overline text-muted-foreground uppercase">
                {label}
            </p>
            <div className="flex flex-wrap items-center gap-3">{children}</div>
        </div>
    );
}

export default function ButtonSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            <Row label={t('Variants')}>
                <Button>
                    <Plus />
                    {t('New retro')}
                </Button>
                <Button variant="secondary">{t('Join')}</Button>
                <Button variant="outline">
                    <Share2 />
                    {t('Share the link')}
                </Button>
                <Button variant="ghost">{t('Cancel')}</Button>
                <Button variant="destructive">
                    <Trash2 />
                    {t('Delete the session')}
                </Button>
                <Button variant="link">{t('See all actions')}</Button>
            </Row>
            <Row label={t('Sizes and icon')}>
                <Button size="sm">{t('Small')}</Button>
                <Button>{t('Medium')}</Button>
                <Button size="lg">{t('Start the session')}</Button>
                <Button
                    size="icon"
                    variant="outline"
                    aria-label={t('Settings')}
                >
                    <Settings2 />
                </Button>
                <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t('Settings')}
                >
                    <Settings2 />
                </Button>
                <Button size="icon-lg" aria-label={t('Next phase')}>
                    <ArrowRight />
                </Button>
                <Button>
                    {t('Next phase')}
                    <ArrowRight />
                </Button>
            </Row>
            <Row label={t('Outline on a card')}>
                <div className="flex gap-3 rounded-xl border bg-card p-4 shadow-card">
                    <Button variant="outline">{t('Share the link')}</Button>
                    <Button variant="outline" disabled>
                        {t('Disabled')}
                    </Button>
                </div>
            </Row>
            <Row label={t('States')}>
                <Button>{t('Default')}</Button>
                <Button className="bg-[color-mix(in_oklab,var(--primary),var(--foreground)_14%)]">
                    {t('Hover')}
                </Button>
                <Button className="ring-2 ring-ring ring-offset-2 ring-offset-background">
                    {t('Keyboard focus')}
                </Button>
                <Button className="translate-y-px">{t('Active')}</Button>
                <Button disabled>{t('Disabled')}</Button>
                <LoadingButton loading>{t('Creating…')}</LoadingButton>
                <LoadingButton loading loader="trema" variant="outline">
                    {t('Connecting')}
                </LoadingButton>
            </Row>
            <Row label={t('Link variant')}>
                <p className="text-sm">
                    {t('You have pending items.')}{' '}
                    <Button variant="link" className="h-auto p-0">
                        {t('See all actions')}
                    </Button>
                </p>
            </Row>
        </div>
    );
}
