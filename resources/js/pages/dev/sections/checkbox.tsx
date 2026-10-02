import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'ui';

const noop = (): void => {};

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function CheckboxStates() {
    const { t } = useTrans();
    const [checked, setChecked] = useState<boolean | 'indeterminate'>(true);

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Example label={t('Off')}>
                <Checkbox
                    checked={false}
                    onCheckedChange={noop}
                    label={t('Allow comments')}
                />
            </Example>
            <Example label={t('On, interactive')}>
                <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => setChecked(value)}
                    label={t('Allow comments')}
                    description={t('Participants can reply under each card.')}
                />
            </Example>
            <Example label={t('Mixed')}>
                <Checkbox
                    checked="indeterminate"
                    onCheckedChange={noop}
                    label={t('Select all actions')}
                />
            </Example>
            <Example label={t('Disabled off')}>
                <Checkbox
                    checked={false}
                    disabled
                    label={t('Allow comments')}
                />
            </Example>
            <Example label={t('Disabled on')}>
                <Checkbox checked disabled label={t('Allow comments')} />
            </Example>
            <Example label={t('Long label and description')}>
                <Checkbox
                    checked={false}
                    onCheckedChange={noop}
                    label={t(
                        'Allow every participant of the team to add, edit and remove cards during the whole session',
                    )}
                    description={t(
                        'Facilitators keep the right to lock a card at any time, whatever this setting says, and the change applies to the next phase.',
                    )}
                />
            </Example>
        </div>
    );
}

function RadioStates() {
    const { t } = useTrans();
    const [value, setValue] = useState('own');
    const [cardValue, setCardValue] = useState('all');
    const options = [
        {
            value: 'all',
            label: t('Everyone'),
            description: t('Votes are public.'),
        },
        {
            value: 'own',
            label: t('Only mine'),
            description: t('Only your own votes are shown.'),
        },
        {
            value: 'none',
            label: t('Nobody'),
            description: t('Votes are hidden.'),
            disabled: true,
        },
    ];

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Example label={t('Radio group')}>
                <RadioGroup
                    aria-label={t('Vote visibility')}
                    value={value}
                    onValueChange={setValue}
                    options={options}
                />
            </Example>
            <Example label={t('Radio group, cards')}>
                <RadioGroup
                    aria-label={t('Vote visibility')}
                    variant="card"
                    value={cardValue}
                    onValueChange={setCardValue}
                    options={options}
                />
            </Example>
        </div>
    );
}

function SwitchStates() {
    const { t } = useTrans();
    const [on, setOn] = useState(true);

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Example label={t('Off')}>
                <Switch
                    checked={false}
                    onCheckedChange={noop}
                    label={t('Enable reactions')}
                />
            </Example>
            <Example label={t('On, interactive')}>
                <Switch
                    checked={on}
                    onCheckedChange={setOn}
                    label={t('Enable reactions')}
                    description={t('Emoji bursts appear on cards.')}
                />
            </Example>
            <Example label={t('Disabled off')}>
                <Switch
                    checked={false}
                    disabled
                    label={t('Enable reactions')}
                />
            </Example>
            <Example label={t('Disabled on')}>
                <Switch checked disabled label={t('Enable reactions')} />
            </Example>
            <Example label={t('Locked with reason')}>
                <Switch
                    checked
                    onCheckedChange={noop}
                    label={t('Require SSO')}
                    lockedReason={t('Enforced by the instance')}
                />
            </Example>
        </div>
    );
}

export default function CheckboxSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('Checkbox')}>
                <CheckboxStates />
            </Example>
            <Example label={t('RadioGroup')}>
                <RadioStates />
            </Example>
            <Example label={t('Switch')}>
                <SwitchStates />
            </Example>
        </div>
    );
}
