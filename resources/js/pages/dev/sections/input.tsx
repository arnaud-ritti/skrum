import { Copy, Link2, Mail, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { TextareaField, TextField } from '@/components/skrum/text-field';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'ui';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">
                {label}
            </p>
            {children}
        </div>
    );
}

export default function InputSection() {
    const { t } = useTrans();

    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,17.5rem),1fr))] gap-x-5 gap-y-6 p-4 md:p-6">
            <State label={t('Default (filled)')}>
                <TextField
                    label={t('Session name')}
                    description={t('Visible to every participant.')}
                    defaultValue={t('Sprint 42 retro — Atlas')}
                />
            </State>
            <State label={t('Placeholder')}>
                <TextField
                    label={t('Retro goal')}
                    placeholder={t('E.g. make our releases more reliable')}
                />
            </State>
            <State label={t('Focus (click or tab into the field)')}>
                <TextField
                    label={t('Your first name')}
                    description={t('Leave empty to stay anonymous.')}
                    defaultValue="Camille"
                />
            </State>
            <State label={t('Invalid with message')}>
                <TextField
                    label={t('Facilitator email')}
                    defaultValue="theo.martin@atlas"
                    error={t('Incomplete email address.')}
                />
            </State>
            <State label={t('Invalid and focused')}>
                <TextField
                    label={t('Session code')}
                    defaultValue="ATL-9Q"
                    className="font-mono"
                    error={t('The code is 8 characters long.')}
                />
            </State>
            <State label={t('Disabled')}>
                <TextField
                    label={t('Invitation link')}
                    description={t('Generated when the session starts.')}
                    defaultValue="skrum.app/j/atlas-42"
                    disabled
                />
            </State>
            <State label={t('With prefix icon')}>
                <div className="flex flex-col gap-2">
                    <TextField
                        label={t('Search')}
                        icon={Search}
                        placeholder={t('Search a card…')}
                    />
                    <TextField
                        label={t('Email')}
                        icon={Mail}
                        defaultValue="ines.benali@atlas.io"
                    />
                </div>
            </State>
            <State label={t('With icon and suffix button')}>
                <TextField
                    label={t('Ticket link')}
                    icon={Link2}
                    defaultValue="jira.atlas.io/browse/ATLAS-1287"
                    suffix={
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={t('Copy')}
                        >
                            <Copy aria-hidden="true" />
                        </Button>
                    }
                />
            </State>
            <State label={t('Textarea with counter')}>
                <TextareaField
                    label={t('Your card')}
                    placeholder={t('What went well this sprint?')}
                    description={t('Anonymous to other participants.')}
                />
            </State>
            <State label={t('Textarea, counter near the limit')}>
                <TextareaField
                    label={t('Action context')}
                    description={t('Light Markdown accepted.')}
                    defaultValue={t(
                        'End-to-end tests break one run in three on CI. Nadia suggests isolating the datasets per worker and automatically retrying flaky specs before blocking the merge request, so the team keeps shipping while we fix the root cause properly.',
                    )}
                />
            </State>
            <State label={t('Textarea invalid')}>
                <TextareaField
                    label={t('Your card')}
                    error={t('Write at least a few words.')}
                />
            </State>
            <State label={t('Textarea disabled')}>
                <TextareaField
                    label={t('Your card')}
                    defaultValue={t('The session is closed.')}
                    disabled
                />
            </State>
        </div>
    );
}
