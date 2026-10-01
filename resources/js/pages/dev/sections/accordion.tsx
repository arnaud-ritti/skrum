import { History, Timer, Vote, VenetianMask } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { Accordion } from '@/components/ui/accordion';
import { CollapsibleBlock } from '@/components/ui/collapsible';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'ui';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground">
                {label}
            </h3>
            {children}
        </section>
    );
}

export default function AccordionSection() {
    const { t } = useTrans();

    const faq = [
        {
            value: 'free',
            title: t('Is Skrüm free for small teams?'),
            content: t('Yes, up to ten members per team.'),
        },
        {
            value: 'anon',
            title: t('Can retros be anonymous?'),
            content: t(
                'Cards can hide their author until the discussion starts.',
            ),
        },
        {
            value: 'export',
            title: t('Can I export a session?'),
            content: t('Every session exports to Markdown and CSV.'),
        },
    ];

    const settings = [
        {
            value: 'timer',
            title: t('Timer and phases'),
            summary: t(':count min per phase', { count: 5 }),
            icon: Timer,
            content: t('Set the length of each phase.'),
        },
        {
            value: 'vote',
            title: t('Vote'),
            summary: t(':count votes each', { count: 3 }),
            icon: Vote,
            content: t('Choose how many votes each participant gets.'),
        },
        {
            value: 'anonymity',
            title: t('Anonymity'),
            summary: t('Hidden until discussion'),
            icon: VenetianMask,
            content: t('Authors are revealed when the discussion starts.'),
        },
        {
            value: 'locked',
            title: t('Integrations'),
            summary: t('Unavailable'),
            icon: Timer,
            disabled: true,
            content: t('Not available on this plan.'),
        },
    ];

    return (
        <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
            <State label={t('Single, closed')}>
                <Accordion type="single" collapsible items={faq} />
            </State>
            <State label={t('Single, open')}>
                <Accordion type="single" defaultValue="anon" items={faq} />
            </State>
            <State label={t('Multiple, plain')}>
                <Accordion
                    type="multiple"
                    defaultValue={['free', 'export']}
                    items={faq}
                />
            </State>
            <State
                label={t('Card variant, settings with summary, one disabled')}
            >
                <Accordion
                    type="multiple"
                    variant="card"
                    defaultValue={['vote']}
                    items={settings}
                />
            </State>
            <State label={t('Single item, no collapsing')}>
                <Accordion
                    type="single"
                    defaultValue="free"
                    items={faq.slice(0, 1)}
                />
            </State>
            <State label={t('Empty list')}>
                <Accordion type="single" items={[]} />
            </State>
            <State label={t('Collapsible, closed')}>
                <CollapsibleBlock
                    trigger={{ icon: History, label: t('Rounds'), count: 2 }}
                >
                    <p className="text-sm">
                        {t('Round 1: spread. Round 2: consensus.')}
                    </p>
                </CollapsibleBlock>
            </State>
            <State label={t('Collapsible, open')}>
                <CollapsibleBlock
                    defaultOpen
                    trigger={{ icon: History, label: t('Rounds'), count: 2 }}
                >
                    <p className="text-sm">
                        {t('Round 1: spread. Round 2: consensus.')}
                    </p>
                </CollapsibleBlock>
            </State>
        </div>
    );
}
