import { useState } from 'react';
import type { ReactNode } from 'react';
import { AdminsList } from '@/components/admin/admins/admins-list';
import { CandidateCombobox } from '@/components/admin/admins/candidate-combobox';
import { RevokeAdminDialog } from '@/components/admin/admins/revoke-admin-dialog';
import type {
    AdminCandidate,
    CandidateSearchStatus,
    InstanceAdmin,
} from '@/components/admin/admins/types';
import type { BenchGroup } from '@/components/dev/bench';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};

const refuse = (): Promise<void> => Promise.reject(new Error('refused'));

function avatar(digit: string): string {
    return `/avatars/${digit.repeat(32)}.svg`;
}

const people = [
    'Ada Lovelace',
    'Alan Turing',
    'Barbara Liskov',
    'Dennis Ritchie',
    'Edsger Dijkstra',
    'Grace Hopper',
    'Hedy Lamarr',
    'Katherine Johnson',
    'Linus Torvalds',
    'Margaret Hamilton',
    'Radia Perlman',
    'Tim Berners-Lee',
];

const twelveAdmins: InstanceAdmin[] = people.map((name, index) => ({
    id: `admin-${index}`,
    name,
    email: `${name.toLowerCase().replaceAll(' ', '.')}@nordlys.example`,
    avatarUrl: avatar((index % 10).toString()),
    isSelf: index === 0,
    canRevoke: true,
}));

const lastAdmin: InstanceAdmin[] = [
    { ...twelveAdmins[0], isSelf: true, canRevoke: false },
];

const longAdmins: InstanceAdmin[] = [
    {
        id: 'long',
        name: 'Maximilian Alexander Bartholomew Montgomery-Wellington Smith',
        email: 'maximilian.alexander.bartholomew.montgomery-wellington.smith@a-very-long-company-domain-name.example',
        avatarUrl: avatar('a'),
        isSelf: true,
        canRevoke: true,
    },
    twelveAdmins[5],
];

const candidates: AdminCandidate[] = twelveAdmins
    .slice(6, 9)
    .map(({ id, name, email, avatarUrl }) => ({ id, name, email, avatarUrl }));

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function ComboboxExample({
    status,
    query,
    results = [],
    error,
}: {
    status: CandidateSearchStatus;
    query: string;
    results?: AdminCandidate[];
    error?: string;
}) {
    const { t } = useTrans();
    const [value, setValue] = useState<AdminCandidate | null>(null);

    return (
        <div className="max-w-md">
            <CandidateCombobox
                label={t('Member')}
                query={query}
                onQueryChange={noop}
                candidates={results}
                status={status}
                value={value}
                onValueChange={setValue}
                error={error}
            />
        </div>
    );
}

function DialogExample({
    admin,
    label,
    error,
}: {
    admin: InstanceAdmin;
    label: string;
    error?: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div>
            <Button variant="outline" onClick={() => setOpen(true)}>
                <span className="truncate">{label}</span>
            </Button>
            <RevokeAdminDialog
                admin={admin}
                open={open}
                onOpenChange={setOpen}
                onConfirm={refuse}
                error={error}
            />
        </div>
    );
}

export default function AdminAdminsSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('No admin')}>
                <Card>
                    <AdminsList admins={[]} onRevoke={noop} />
                </Card>
            </Example>
            <Example label={t('Last admin: revoke disabled with the reason')}>
                <Card>
                    <AdminsList admins={lastAdmin} onRevoke={noop} />
                </Card>
            </Example>
            <Example label={t('12 admins')}>
                <Card>
                    <AdminsList admins={twelveAdmins} onRevoke={noop} />
                </Card>
            </Example>
            <Example label={t('Long name and email')}>
                <Card>
                    <AdminsList admins={longAdmins} onRevoke={noop} />
                </Card>
            </Example>
            <Example label={t('Narrow container: stacked rows')}>
                <Card className="max-w-80">
                    <AdminsList admins={longAdmins} onRevoke={noop} />
                </Card>
            </Example>
            <Example label={t('Search: under 2 characters')}>
                <ComboboxExample status="idle" query="a" />
            </Example>
            <Example label={t('Search: loading')}>
                <ComboboxExample status="loading" query="ham" />
            </Example>
            <Example label={t('Search: results')}>
                <ComboboxExample
                    status="ready"
                    query="ha"
                    results={candidates}
                />
            </Example>
            <Example label={t('Search: no result, with a refused grant')}>
                <ComboboxExample
                    status="ready"
                    query="zz"
                    error={t('Something went wrong. Please try again.')}
                />
            </Example>
            <Example label={t('Revoke dialog')}>
                <div className="flex flex-wrap gap-2">
                    <DialogExample
                        admin={twelveAdmins[5]}
                        label={t('Revoke another admin')}
                    />
                    <DialogExample
                        admin={twelveAdmins[0]}
                        label={t('Revoke yourself')}
                    />
                    <DialogExample
                        admin={lastAdmin[0]}
                        label={t('Refused by the server')}
                        error={t('An instance needs at least one admin.')}
                    />
                </div>
            </Example>
        </div>
    );
}
