import { ActionItem } from '@/components/skrum/action-item';
import { RetroCard } from '@/components/skrum/retro-card';
import { useTrans } from '@/hooks/use-trans';

/**
 * Brand panel of the split auth screen: the promise and three sample notes.
 * Decoration only, so it is hidden from assistive technology and inert.
 * Each note floats on a wrapper of its own, so its tilt and offset stay.
 */
export function AuthAside() {
    const { t } = useTrans();

    return (
        <div
            data-slot="auth-aside"
            aria-hidden="true"
            inert
            className="-m-4 flex min-w-0 flex-1 flex-col justify-center gap-5 self-stretch rounded-2xl border border-[color-mix(in_oklch,var(--secondary-foreground)_14%,transparent)] bg-[color-mix(in_oklch,var(--card)_35%,transparent)] p-12"
        >
            <p className="max-w-130 font-display text-display-xl text-foreground">
                {t('Meetings end, actions stay.')}
            </p>
            <p className="max-w-115 text-base/6.5 text-foreground/80">
                {t(
                    'Retros, planning poker, whiteboard and surveys for teams who want their rituals to be worth the time.',
                )}
            </p>
            <div className="mt-4 flex w-85 max-w-full flex-col gap-3">
                <div
                    data-slot="auth-aside-note"
                    className="animate-float motion-reduce:animate-none"
                >
                    <RetroCard
                        id="auth-aside-went-well"
                        domId="auth-aside-went-well"
                        color="moss"
                        className="-rotate-2 shadow-raised"
                        text={t('The client demo went really well.')}
                        author={{ id: 'camille', name: 'Camille', presence: 4 }}
                        votes={{ total: 4, mine: 0 }}
                    />
                </div>
                <div
                    data-slot="auth-aside-note"
                    className="animate-float [animation-delay:-2.5s] [animation-duration:8s] motion-reduce:animate-none"
                >
                    <RetroCard
                        id="auth-aside-to-improve"
                        domId="auth-aside-to-improve"
                        color="coral"
                        className="translate-x-7 -translate-y-1.5 rotate-2 shadow-raised"
                        text={t('E2E tests break one time out of three in CI.')}
                        author={null}
                        votes={{ total: 9, mine: 0 }}
                    />
                </div>
                <div
                    data-slot="auth-aside-note"
                    className="animate-float [animation-delay:-5s] [animation-duration:6s] motion-reduce:animate-none"
                >
                    <ActionItem
                        className="translate-x-2 -translate-y-1 -rotate-1 shadow-raised"
                        title={t('Quarantine the flaky tests')}
                        status="completed"
                        priority="medium"
                        owner={{ id: 'lucas', name: 'Lucas D', presence: 8 }}
                        compact
                        canComplete={false}
                        tabIndex={-1}
                        links={[
                            {
                                id: 'auth-aside-ticket',
                                source: 'jira',
                                key: 'ATLAS-1302',
                                url: '#',
                            },
                        ]}
                    />
                </div>
            </div>
        </div>
    );
}
