import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { BenchOverlayStage } from '@/components/dev/bench';
import type { BenchGroup } from '@/components/dev/bench';
import {
    ShareDialog,
    ShareDialogContent,
} from '@/components/skrum/share-dialog';
import type {
    ShareDialogProps,
    ShareMember,
    SessionRole,
} from '@/components/skrum/share-dialog';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { ShareChannel } from '@/types';

export const group: BenchGroup = 'skrum';

type StateKey =
    | 'active'
    | 'members'
    | 'expired'
    | 'guestsOff'
    | 'readOnly'
    | 'mobile'
    | 'minimal'
    | 'extreme';

const wait = (): Promise<void> =>
    new Promise((resolve) => window.setTimeout(resolve, 400));

const people: ShareMember[] = [
    {
        id: 'a',
        name: 'Alice Martin',
        email: 'alice@atlas.dev',
        presence: 1,
        inSession: false,
    },
    {
        id: 'b',
        name: 'Bob Stone',
        email: 'bob@atlas.dev',
        presence: 2,
        inSession: true,
    },
    {
        id: 'c',
        name: 'Carla Diaz',
        email: 'carla@atlas.dev',
        presence: 3,
        inSession: false,
    },
    {
        id: 'd',
        name: 'Dmitri Volkov',
        email: 'dmitri@atlas.dev',
        presence: 4,
        inSession: false,
    },
];

const manyPeople: ShareMember[] = Array.from({ length: 200 }, (_, index) => ({
    id: `m${index}`,
    name:
        index === 0
            ? 'Bartholomew Montgomery-Featherstonehaugh III of Atlas Team'
            : `Member ${index}`,
    email: `member${index}@atlas.dev`,
    presence: ((index % 12) + 1) as ShareMember['presence'],
    inSession: index % 7 === 0,
}));

const channels: ShareChannel[] = ['slack', 'msteams', 'mattermost'];

export default function ShareDialogSection() {
    const { t } = useTrans();
    const [state, setState] = useState<StateKey>('active');
    const [open, setOpen] = useState(true);
    const [settings, setSettings] = useState<{
        defaultRole: SessionRole;
        allowGuests: boolean;
        expiry: '1h' | '24h' | '7d' | 'session_end' | 'never';
    }>({ defaultRole: 'participant', allowGuests: true, expiry: '24h' });

    const choose = (next: StateKey): void => {
        setState(next);
        setOpen(true);
    };

    const states: { key: StateKey; label: string }[] = [
        { key: 'active', label: t('Active link (desktop dialog)') },
        { key: 'members', label: t('Members tab with combobox') },
        { key: 'expired', label: t('Expired link') },
        { key: 'guestsOff', label: t('Guest access off') },
        { key: 'readOnly', label: t('Read-only participant view') },
        { key: 'mobile', label: t('Mobile drawer') },
        { key: 'minimal', label: t('Only the link, no optional props') },
        {
            key: 'extreme',
            label: t('Extreme data: 60-character title, 200 members'),
        },
    ];

    const base: ShareDialogProps = {
        open,
        onOpenChange: setOpen,
        session: {
            id: 's1',
            kind: 'retro',
            title: t('Sprint 42 retro'),
            teamName: 'Atlas',
            presentCount: 4,
        },
        invite: {
            url: 'https://skrum.atlas.dev/j/ATL-4821-k7Qp',
            allowGuests: settings.allowGuests,
            status: 'active',
            code: 'ATL-4821',
            joinUrl: 'skrum.atlas.dev/join',
            defaultRole: settings.defaultRole,
            expiry: settings.expiry,
            expiresAt: '2026-10-08T18:00:00Z',
        },
        canManage: true,
        onCopy: () => true,
        onChange: (patch) =>
            setSettings((current) => ({ ...current, ...patch })),
        onRegenerate: wait,
        onDownloadQr: () => undefined,
        channels,
        onShareToChannel: async () => {
            await wait();

            return true;
        },
    };

    const byState: Record<StateKey, ShareDialogProps> = {
        active: base,
        members: {
            ...base,
            members: people,
            onInvite: wait,
            tab: 'members',
        },
        expired: {
            ...base,
            invite: {
                ...base.invite,
                status: 'expired',
                expiresAt: '2026-10-01T09:30:00Z',
            },
        },
        guestsOff: {
            ...base,
            invite: { ...base.invite, url: null, allowGuests: false },
        },
        readOnly: { ...base, canManage: false },
        mobile: {
            ...base,
            isMobile: true,
            onShare: () => undefined,
            channels: undefined,
        },
        minimal: {
            ...base,
            invite: { url: base.invite.url, allowGuests: true },
            onChange: undefined,
            onRegenerate: undefined,
            channels: undefined,
            onShareToChannel: undefined,
        },
        extreme: {
            ...base,
            session: {
                id: 's2',
                kind: 'poker',
                title: 'Planning poker for the quarterly roadmap alignment session',
                teamName: 'Atlas platform and infrastructure team',
                presentCount: 14,
            },
            members: manyPeople,
            onInvite: wait,
            tab: 'members',
        },
    };

    const inline = states.filter((entry) => entry.key !== 'mobile');

    return (
        <div className="flex min-w-0 flex-col gap-6 p-4 md:p-6">
            {inline.map((entry) => (
                <div key={entry.key} className="flex min-w-0 flex-col gap-2">
                    <p className="text-sm font-medium text-muted-foreground">
                        {entry.label}
                    </p>
                    <div className="grid w-full max-w-128 min-w-0 gap-4 rounded-lg border bg-background p-6 shadow-card">
                        <ShareDialogContent {...byState[entry.key]} />
                    </div>
                </div>
            ))}
            <div className="flex min-w-0 flex-col gap-2">
                <p className="text-sm font-medium text-muted-foreground">
                    {t('Mobile drawer, body without the overlay')}
                </p>
                <div className="grid w-full max-w-sm min-w-0 gap-4 rounded-lg border bg-background p-4 shadow-card">
                    <ShareDialogContent {...byState.mobile} />
                </div>
            </div>
            <BenchOverlayStage>
                <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-sm font-medium text-muted-foreground">
                        {t('Real overlay, open: pick a state to reopen it')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {states.map((entry) => (
                            <Button
                                key={entry.key}
                                type="button"
                                variant={
                                    state === entry.key ? 'default' : 'outline'
                                }
                                size="sm"
                                onClick={() => choose(entry.key)}
                                className="max-w-full"
                            >
                                <UserPlus aria-hidden />
                                <span className="truncate">{entry.label}</span>
                            </Button>
                        ))}
                    </div>
                    <ShareDialog key={state} {...byState[state]} />
                </div>
            </BenchOverlayStage>
        </div>
    );
}
