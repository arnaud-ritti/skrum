import {
    Check,
    Copy,
    Download,
    Eye,
    Link2Off,
    RefreshCw,
    Share2,
    Send,
    TriangleAlert,
    User,
    WandSparkles,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { KeyboardEvent, ReactNode } from 'react';
import { ProviderMark } from '@/components/skrum/provider-mark';
import { Alert } from '@/components/ui/alert';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useTrans } from '@/hooks/use-trans';
import { postLinkLabel } from '@/lib/integrations';
import { cn } from '@/lib/utils';
import type { ShareChannel } from '@/types';
import { ConfirmDialog } from './confirm-dialog';

export type SessionRole = 'participant' | 'observer' | 'facilitator';
export type LinkExpiry = '1h' | '24h' | '7d' | 'session_end' | 'never';
export type ShareSessionKind =
    | 'retro'
    | 'poker'
    | 'whiteboard'
    | 'game'
    | 'icebreaker'
    | 'survey';
export type ShareTab = 'link' | 'members';

export type ShareInvite = {
    url: string | null;
    allowGuests: boolean;
    status?: 'active' | 'expired';
    code?: string;
    joinUrl?: string;
    defaultRole?: SessionRole;
    expiry?: LinkExpiry;
    expiresAt?: string | null;
};

export type ShareMember = {
    id: string;
    name: string;
    email: string;
    presence?: number;
    avatarUrl?: string;
    inSession: boolean;
};

export type ShareSettingsPatch = Partial<
    Pick<ShareInvite, 'defaultRole' | 'allowGuests' | 'expiry'>
>;

export type ShareDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    session: {
        id: string;
        kind: ShareSessionKind;
        title: string;
        teamName?: string;
        presentCount?: number;
    };
    invite: ShareInvite;
    canManage: boolean;
    /** By default the invite's link or code goes to the clipboard, with a toast. */
    onCopy?: (what: 'url' | 'code') => void | boolean | Promise<void | boolean>;
    onChange?: (patch: ShareSettingsPatch) => void;
    onRegenerate?: () => Promise<void>;
    onDownloadQr?: () => void;
    onShare?: () => void;
    channels?: ShareChannel[];
    onShareToChannel?: (
        channel: ShareChannel,
        includeGuestLink: boolean,
    ) => Promise<boolean | void>;
    /** Under the channel buttons (delivery lines); shown even when no channel is left. */
    channelsExtra?: ReactNode;
    members?: ShareMember[];
    onInvite?: (memberIds: string[], role: SessionRole) => Promise<void>;
    tab?: ShareTab;
    onTabChange?: (tab: ShareTab) => void;
    isMobile?: boolean;
    /** Id of the "Anonymous guests" switch control, for a page that targets it. */
    guestSwitchId?: string;
};

const roleIcons: Record<SessionRole, LucideIcon> = {
    participant: User,
    observer: Eye,
    facilitator: WandSparkles,
};

const roles: SessionRole[] = ['participant', 'observer', 'facilitator'];
const expiries: LinkExpiry[] = ['1h', '24h', '7d', 'session_end', 'never'];

function useLabels() {
    const { t } = useTrans();

    const role = (value: SessionRole): { label: string; help: string } => {
        switch (value) {
            case 'participant':
                return {
                    label: t('Participant'),
                    help: t('Can add cards and vote'),
                };
            case 'observer':
                return {
                    label: t('Observer'),
                    help: t('Can follow without taking part'),
                };
            case 'facilitator':
                return {
                    label: t('Facilitator'),
                    help: t('Can run and configure the session'),
                };
        }
    };

    const expiry = (value: LinkExpiry): string => {
        switch (value) {
            case '1h':
                return t('1 hour');
            case '24h':
                return t('24 hours');
            case '7d':
                return t('7 days');
            case 'session_end':
                return t('End of session');
            case 'never':
                return t('Never');
        }
    };

    return { role, expiry };
}

function formatDate(iso: string): string {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
        return iso;
    }

    const language =
        typeof document === 'undefined'
            ? undefined
            : document.documentElement.lang || undefined;

    return new Intl.DateTimeFormat(language, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function useCopied(invite: ShareInvite, onCopy?: ShareDialogProps['onCopy']) {
    const { t } = useTrans();
    const [copied, setCopied] = useState<'url' | 'code' | null>(null);

    const copyInvite = async (what: 'url' | 'code'): Promise<boolean> => {
        const text = what === 'code' ? invite.code : invite.url;

        if (!text) {
            return false;
        }

        try {
            await navigator.clipboard.writeText(text);
            toast(what === 'code' ? t('Code copied') : t('Link copied'));

            return true;
        } catch {
            toast.error(t('Something went wrong. Please try again.'));

            return false;
        }
    };

    useEffect(() => {
        if (copied === null) {
            return;
        }

        const timer = window.setTimeout(() => setCopied(null), 2000);

        return () => window.clearTimeout(timer);
    }, [copied]);

    const copy = async (what: 'url' | 'code'): Promise<void> => {
        try {
            const result = await (onCopy ?? copyInvite)(what);

            if (result === false) {
                return;
            }

            setCopied(what);
        } catch {
            return;
        }
    };

    return { copied, copy };
}

function CopyButton({
    label,
    isCopied,
    disabled,
    onClick,
    buttonRef,
    className,
}: {
    label: string;
    isCopied: boolean;
    disabled?: boolean;
    onClick: () => void;
    buttonRef?: React.Ref<HTMLButtonElement>;
    className?: string;
}) {
    const { t } = useTrans();
    const Icon = isCopied ? Check : Copy;

    return (
        <Button
            ref={buttonRef}
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={onClick}
            data-copied={isCopied}
            className={cn(
                'shrink-0',
                isCopied &&
                    'border-skrum-success-text/35 bg-skrum-success-soft text-skrum-success-text hover:bg-skrum-success-soft hover:text-skrum-success-text',
                className,
            )}
        >
            <Icon aria-hidden />
            <span aria-live="polite" className="truncate">
                {isCopied ? t('Copied') : label}
            </span>
        </Button>
    );
}

function InviteQr({
    url,
    title,
    faded,
    expiredBadge,
    downloadDisabled,
    onDownloadQr,
}: {
    url: string;
    title: string;
    faded: boolean;
    expiredBadge: boolean;
    downloadDisabled: boolean;
    onDownloadQr?: () => void;
}) {
    const { t } = useTrans();
    const tileRef = useRef<HTMLDivElement>(null);

    const download = (): void => {
        onDownloadQr?.();

        const tile = tileRef.current;
        const svg = tile?.querySelector('svg');

        if (!tile || !svg) {
            return;
        }

        const styles = getComputedStyle(tile);
        const markup = new XMLSerializer()
            .serializeToString(svg)
            .replaceAll('currentColor', styles.color);
        const image = new Image();

        image.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 1024;

            canvas.width = size;
            canvas.height = size;

            const context = canvas.getContext('2d');

            if (!context) {
                return;
            }

            context.fillStyle = styles.backgroundColor;
            context.fillRect(0, 0, size, size);
            context.drawImage(image, 0, 0, size, size);

            const link = document.createElement('a');

            link.href = canvas.toDataURL('image/png');
            link.download = 'skrum-qr.png';
            link.click();
        };
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    };

    return (
        <div className="flex shrink-0 flex-col items-center gap-2">
            <div className="relative">
                <div
                    ref={tileRef}
                    data-slot="share-qr"
                    role="img"
                    aria-label={t('QR code to join :title', { title })}
                    className={cn(
                        'size-30 overflow-hidden rounded-md bg-card text-foreground ring-1 ring-border dark:bg-foreground dark:text-background',
                        faded && 'opacity-20 grayscale',
                    )}
                >
                    <QRCodeSVG
                        value={url}
                        size={256}
                        marginSize={4}
                        level="M"
                        fgColor="currentColor"
                        bgColor="transparent"
                        aria-hidden
                        className="size-full"
                    />
                </div>
                {expiredBadge && (
                    <Badge
                        variant="warning"
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                    >
                        <span className="truncate">{t('Expired')}</span>
                    </Badge>
                )}
            </div>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={downloadDisabled}
                onClick={download}
                className="max-w-full"
            >
                <Download aria-hidden />
                <span className="truncate">{t('Download the QR code')}</span>
            </Button>
        </div>
    );
}

function SettingRow({
    id,
    label,
    help,
    children,
}: {
    id: string;
    label: string;
    help?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1 basis-40">
                <p id={id} className="text-sm font-semibold">
                    {label}
                </p>
                {help !== undefined && (
                    <p className="text-xs text-muted-foreground">{help}</p>
                )}
            </div>
            {children}
        </div>
    );
}

function RoleSelect({
    value,
    onValueChange,
    labelledBy,
}: {
    value: SessionRole;
    onValueChange: (value: SessionRole) => void;
    labelledBy: string;
}) {
    const labels = useLabels();

    return (
        <Select
            value={value}
            onValueChange={(next) => onValueChange(next as SessionRole)}
        >
            <SelectTrigger className="w-44" aria-labelledby={labelledBy}>
                <SelectValue>
                    <span className="truncate">{labels.role(value).label}</span>
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {roles.map((option) => {
                    const Icon = roleIcons[option];
                    const { label, help } = labels.role(option);

                    return (
                        <SelectItem
                            key={option}
                            value={option}
                            className="items-start py-1.5"
                        >
                            <Icon aria-hidden className="mt-0.5" />
                            <span className="flex min-w-0 flex-col">
                                <span className="truncate">{label}</span>
                                <span className="truncate text-xs text-muted-foreground">
                                    {help}
                                </span>
                            </span>
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
}

function Highlight({ text, query }: { text: string; query: string }) {
    const index = query === '' ? -1 : text.toLowerCase().indexOf(query);

    if (index < 0) {
        return <>{text}</>;
    }

    return (
        <>
            {text.slice(0, index)}
            <strong className="font-bold underline">
                {text.slice(index, index + query.length)}
            </strong>
            {text.slice(index + query.length)}
        </>
    );
}

function MembersPanel({
    members,
    defaultRole,
    onInvite,
}: {
    members: ShareMember[];
    defaultRole: SessionRole;
    onInvite: (memberIds: string[], role: SessionRole) => Promise<void>;
}) {
    const { t } = useTrans();
    const listId = useId();
    const roleLabelId = useId();
    const [query, setQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [role, setRole] = useState<SessionRole>(defaultRole);
    const [previousDefaultRole, setPreviousDefaultRole] = useState(defaultRole);

    if (defaultRole !== previousDefaultRole) {
        setPreviousDefaultRole(defaultRole);
        setRole(defaultRole);
    }

    const [pending, setPending] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const normalized = query.trim().toLowerCase();
    const selected = selectedIds
        .map((id) => members.find((member) => member.id === id))
        .filter((member): member is ShareMember => member !== undefined);
    const options = members.filter(
        (member) =>
            !selectedIds.includes(member.id) &&
            (normalized === '' ||
                member.name.toLowerCase().includes(normalized) ||
                member.email.toLowerCase().includes(normalized)),
    );
    const safeActive = Math.max(0, Math.min(activeIndex, options.length - 1));
    const activeOption = options[safeActive];
    const optionId = (id: string) => `${listId}-${id}`;
    const validSelected = selected.filter((member) => !member.inSession);

    const add = (member: ShareMember): void => {
        if (member.inSession) {
            return;
        }

        setSelectedIds((ids) => [...ids, member.id]);
        setQuery('');
        setActiveIndex(0);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex(Math.min(safeActive + 1, options.length - 1));

            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex(Math.max(safeActive - 1, 0));

            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();

            if (isOpen && activeOption) {
                add(activeOption);
            }

            return;
        }

        if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            event.stopPropagation();
            setIsOpen(false);

            return;
        }

        if (event.key === 'Backspace' && query === '' && selectedIds.length) {
            setSelectedIds((ids) => ids.slice(0, -1));
        }
    };

    const activeOptionId =
        isOpen && activeOption ? optionId(activeOption.id) : undefined;

    useEffect(() => {
        if (activeOptionId === undefined) {
            return;
        }

        document
            .getElementById(activeOptionId)
            ?.scrollIntoView?.({ block: 'nearest' });
    }, [activeOptionId]);

    const send = async (): Promise<void> => {
        if (validSelected.length === 0 || pending) {
            return;
        }

        setPending(true);

        try {
            await onInvite(
                validSelected.map((member) => member.id),
                role,
            );
            setSelectedIds([]);
        } catch {
            return;
        } finally {
            setPending(false);
        }
    };

    const count = validSelected.length;

    return (
        <div data-slot="share-members" className="flex min-w-0 flex-col gap-3">
            <div className="relative">
                <div
                    className="flex min-h-10 min-w-0 flex-wrap items-center gap-1 rounded-md border border-input bg-card px-2 py-1 focus-within:ring-2 focus-within:ring-ring"
                    onClick={() => inputRef.current?.focus()}
                >
                    {selected.map((member) => (
                        <span
                            key={member.id}
                            data-slot="share-member-chip"
                            className="inline-flex h-6.5 max-w-full min-w-0 items-center gap-1 rounded-full bg-secondary pr-1 pl-1 text-body-sm font-semibold text-secondary-foreground"
                        >
                            <PersonAvatar
                                name={member.name}
                                src={member.avatarUrl}
                                presence={
                                    member.presence as
                                        | 1
                                        | 2
                                        | 3
                                        | 4
                                        | 5
                                        | 6
                                        | 7
                                        | 8
                                        | 9
                                        | 10
                                        | 11
                                        | 12
                                        | undefined
                                }
                                size="xs"
                                decorative
                            />
                            <span className="truncate">{member.name}</span>
                            <button
                                type="button"
                                aria-label={t('Remove person :name', {
                                    name: member.name,
                                })}
                                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedIds((ids) =>
                                        ids.filter((id) => id !== member.id),
                                    );
                                    inputRef.current?.focus();
                                }}
                            >
                                <X aria-hidden className="size-3" />
                            </button>
                        </span>
                    ))}
                    <input
                        ref={inputRef}
                        type="text"
                        role="combobox"
                        aria-label={t('Add team members')}
                        aria-expanded={isOpen}
                        aria-controls={listId}
                        aria-autocomplete="list"
                        aria-activedescendant={activeOptionId}
                        value={query}
                        placeholder={
                            selected.length === 0
                                ? t('Search by name or email')
                                : undefined
                        }
                        className="h-7 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        onFocus={() => setIsOpen(true)}
                        onBlur={() => setIsOpen(false)}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setIsOpen(true);
                            setActiveIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                    />
                </div>
                <ul
                    id={listId}
                    role="listbox"
                    aria-label={t('Team members')}
                    hidden={!isOpen}
                    className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-popover"
                >
                    {options.length === 0 && (
                        <li
                            role="presentation"
                            className="px-2 py-1.5 text-sm text-muted-foreground"
                        >
                            {t('No member found')}
                        </li>
                    )}
                    {options.map((member, index) => (
                        <li
                            key={member.id}
                            id={optionId(member.id)}
                            role="option"
                            aria-selected={false}
                            aria-disabled={member.inSession || undefined}
                            data-selected={index === safeActive}
                            data-disabled={member.inSession || undefined}
                            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm data-[disabled=true]:opacity-55 data-[selected=true]:bg-accent"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => add(member)}
                        >
                            <PersonAvatar
                                name={member.name}
                                src={member.avatarUrl}
                                size="sm"
                                decorative
                            />
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate font-semibold">
                                    <Highlight
                                        text={member.name}
                                        query={normalized}
                                    />
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                    {member.email}
                                </span>
                            </span>
                            {member.inSession && (
                                <Badge variant="muted">
                                    <span className="truncate">
                                        {t('Already in the session')}
                                    </span>
                                </Badge>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
            <p className="text-xs text-muted-foreground">
                {t('Members get an invitation by email.')}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <span id={roleLabelId} className="sr-only">
                    {t('Role')}
                </span>
                <RoleSelect
                    value={role}
                    onValueChange={setRole}
                    labelledBy={roleLabelId}
                />
                <Button
                    type="button"
                    aria-disabled={count === 0 || pending || undefined}
                    onClick={() => void send()}
                    className="max-w-full min-w-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:shadow-none"
                >
                    <Send aria-hidden />
                    <span className="truncate">
                        {count === 0
                            ? t('Send invitations')
                            : count === 1
                              ? t('Send 1 invitation')
                              : t('Send :count invitations', { count })}
                    </span>
                </Button>
            </div>
        </div>
    );
}

function ChannelsSection({
    channels,
    allowsGuestLink,
    onShareToChannel,
    extra,
}: {
    channels: ShareChannel[];
    allowsGuestLink: boolean;
    onShareToChannel: NonNullable<ShareDialogProps['onShareToChannel']>;
    extra?: ReactNode;
}) {
    const { t } = useTrans();
    const checkboxId = useId();
    const [includeGuestLink, setIncludeGuestLink] = useState(false);
    const [busy, setBusy] = useState<ShareChannel | null>(null);

    const post = async (channel: ShareChannel): Promise<void> => {
        setBusy(channel);

        try {
            await onShareToChannel(
                channel,
                allowsGuestLink && includeGuestLink,
            );
        } catch {
            return;
        } finally {
            setBusy(null);
        }
    };

    return (
        <section
            data-slot="share-channels"
            className="flex min-w-0 flex-col gap-3"
        >
            <h3 className="text-sm font-semibold">{t('Post a link')}</h3>
            {allowsGuestLink && channels.length > 0 && (
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={checkboxId}
                        checked={includeGuestLink}
                        onCheckedChange={(checked) =>
                            setIncludeGuestLink(checked === true)
                        }
                    />
                    <Label htmlFor={checkboxId}>
                        {t('Include the guest link')}
                    </Label>
                </div>
            )}
            {channels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {channels.map((channel) => (
                        <Button
                            key={channel}
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy !== null}
                            onClick={() => void post(channel)}
                            className="max-w-full"
                        >
                            <ProviderMark provider={channel} />
                            <span className="truncate">
                                {postLinkLabel(channel, t)}
                            </span>
                        </Button>
                    ))}
                </div>
            )}
            {extra}
        </section>
    );
}

function ShareBody({
    props,
    copyRef,
    regenerating,
    onRegenerateNow,
}: {
    props: ShareDialogContentProps;
    copyRef?: React.Ref<HTMLButtonElement>;
    regenerating: boolean;
    onRegenerateNow: () => void;
}) {
    const { t } = useTrans();
    const labels = useLabels();
    const {
        invite,
        session,
        canManage,
        isMobile = false,
        onChange,
        onShare,
        onDownloadQr,
        channels = [],
        onShareToChannel,
        channelsExtra,
        guestSwitchId,
    } = props;
    const { copied, copy } = useCopied(invite, props.onCopy);
    const roleId = useId();
    const expiryId = useId();
    const isExpired = invite.status === 'expired';
    const hasLink = invite.allowGuests && invite.url !== null;
    const url = invite.url ?? '';
    const canChange = canManage && onChange !== undefined;
    // Whoever may post gets the handler: a workspace manager can post the
    // link of a session they do not facilitate.
    const hasChannelsExtra =
        channelsExtra !== undefined &&
        channelsExtra !== null &&
        channelsExtra !== false;
    const showChannels =
        onShareToChannel !== undefined &&
        (channels.length > 0 || hasChannelsExtra);
    const expiresText =
        invite.expiresAt !== undefined && invite.expiresAt !== null
            ? formatDate(invite.expiresAt)
            : null;
    const joinText = invite.joinUrl ?? null;

    const alertBlock = isExpired ? (
        <Alert
            variant="warning"
            icon={TriangleAlert}
            title={t('This link has expired')}
            description={
                expiresText === null
                    ? t('Create a new link to invite people again.')
                    : t('It stopped working on :date.', { date: expiresText })
            }
            action={
                canManage && props.onRegenerate ? (
                    <Button
                        type="button"
                        size="sm"
                        disabled={regenerating}
                        onClick={onRegenerateNow}
                    >
                        <RefreshCw aria-hidden />
                        <span className="truncate">
                            {t('Create a new link')}
                        </span>
                    </Button>
                ) : undefined
            }
        />
    ) : null;

    const shareBlock = hasLink && (
        <div
            data-slot="share-block"
            className="flex flex-wrap items-center gap-4 rounded-lg bg-muted p-3"
        >
            <InviteQr
                url={url}
                title={session.title}
                faded={isExpired}
                expiredBadge={isExpired}
                downloadDisabled={isExpired}
                onDownloadQr={onDownloadQr}
            />
            {invite.code !== undefined && (
                <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
                    <p className="text-xs font-semibold text-muted-foreground">
                        {t('Session code')}
                    </p>
                    <p
                        data-slot="share-code"
                        className="font-mono text-2xl font-semibold tracking-wider break-all"
                    >
                        {invite.code}
                    </p>
                    {joinText !== null && (
                        <p className="text-xs text-muted-foreground">
                            {t('Join at :url', { url: joinText })}
                        </p>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isExpired}
                        onClick={() => void copy('code')}
                        className="max-w-full self-start"
                    >
                        {copied === 'code' ? (
                            <Check aria-hidden />
                        ) : (
                            <Copy aria-hidden />
                        )}
                        <span aria-live="polite" className="truncate">
                            {copied === 'code'
                                ? t('Copied')
                                : t('Copy the code')}
                        </span>
                    </Button>
                </div>
            )}
        </div>
    );

    const linkField = hasLink && (
        <div className="flex min-w-0 gap-2">
            <Input
                readOnly
                value={url}
                disabled={isExpired}
                aria-label={t('Guest link')}
                onFocus={(event) => event.target.select()}
                className={cn(
                    'min-w-0 flex-1 truncate bg-muted font-mono text-body-sm',
                    isExpired && 'line-through',
                )}
            />
            <CopyButton
                label={t('Copy')}
                buttonRef={copyRef}
                isCopied={copied === 'url'}
                disabled={isExpired}
                onClick={() => void copy('url')}
            />
        </div>
    );

    const noLinkNotice = !invite.allowGuests && (
        <Alert
            variant="info"
            title={t('Guest link is off')}
            description={t(
                'Guests cannot join with a link while guest access is off.',
            )}
        />
    );

    const guestSwitch = canChange && (
        <Switch
            id={guestSwitchId}
            checked={invite.allowGuests}
            onCheckedChange={(checked) => onChange({ allowGuests: checked })}
            label={t('Anonymous guests allowed')}
            description={
                invite.allowGuests
                    ? t('Anyone with the link can join without an account.')
                    : t('Sign-in required to join.')
            }
        />
    );

    if (isMobile) {
        return (
            <div className="flex min-w-0 flex-col gap-4">
                {alertBlock}
                {noLinkNotice}
                {shareBlock}
                {hasLink && (
                    <div className="grid grid-cols-2 gap-2">
                        <CopyButton
                            label={t('Copy link')}
                            buttonRef={copyRef}
                            isCopied={copied === 'url'}
                            disabled={isExpired}
                            onClick={() => void copy('url')}
                        />
                        {onShare !== undefined && (
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isExpired}
                                onClick={onShare}
                            >
                                <Share2 aria-hidden />
                                <span className="truncate">{t('Share…')}</span>
                            </Button>
                        )}
                    </div>
                )}
                {guestSwitch}
                {showChannels && onShareToChannel && (
                    <ChannelsSection
                        channels={channels}
                        allowsGuestLink={hasLink && !isExpired}
                        onShareToChannel={onShareToChannel}
                        extra={channelsExtra}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="flex min-w-0 flex-col gap-4">
            {alertBlock}
            {noLinkNotice}
            {linkField}
            {shareBlock}
            {canChange && <Separator />}
            {canChange && (
                <div className="flex min-w-0 flex-col gap-3">
                    {invite.defaultRole !== undefined && (
                        <SettingRow
                            id={roleId}
                            label={t('Join as')}
                            help={labels.role(invite.defaultRole).help}
                        >
                            <RoleSelect
                                value={invite.defaultRole}
                                onValueChange={(defaultRole) =>
                                    onChange({ defaultRole })
                                }
                                labelledBy={roleId}
                            />
                        </SettingRow>
                    )}
                    {guestSwitch}
                    {invite.expiry !== undefined && (
                        <SettingRow
                            id={expiryId}
                            label={t('Link expiry')}
                            help={
                                expiresText === null
                                    ? undefined
                                    : t('Expires on :date', {
                                          date: expiresText,
                                      })
                            }
                        >
                            <Select
                                value={invite.expiry}
                                onValueChange={(expiry) =>
                                    onChange({ expiry: expiry as LinkExpiry })
                                }
                            >
                                <SelectTrigger
                                    className="w-44"
                                    aria-labelledby={expiryId}
                                >
                                    <SelectValue>
                                        <span className="truncate">
                                            {labels.expiry(invite.expiry)}
                                        </span>
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {expiries.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {labels.expiry(option)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </SettingRow>
                    )}
                </div>
            )}
            {showChannels && onShareToChannel && (
                <>
                    <Separator />
                    <ChannelsSection
                        channels={channels}
                        allowsGuestLink={hasLink && !isExpired}
                        onShareToChannel={onShareToChannel}
                        extra={channelsExtra}
                    />
                </>
            )}
        </div>
    );
}

export type ShareDialogContentProps = Omit<
    ShareDialogProps,
    'open' | 'onOpenChange'
> & {
    copyRef?: React.Ref<HTMLButtonElement>;
    regenerating?: boolean;
    onRegenerateNow?: () => void;
};

/** The body of the dialog without its overlay shell: tabs, link, QR, members. */
export function ShareDialogContent(props: ShareDialogContentProps) {
    const { t } = useTrans();
    const {
        invite,
        canManage,
        members,
        onInvite,
        copyRef,
        regenerating = false,
        onRegenerateNow,
    } = props;
    const [tab, setTab] = useState<ShareTab>(props.tab ?? 'link');
    const [previousTabProp, setPreviousTabProp] = useState(props.tab);

    if (props.tab !== previousTabProp) {
        setPreviousTabProp(props.tab);

        if (props.tab !== undefined) {
            setTab(props.tab);
        }
    }

    const changeTab = (next: ShareTab): void => {
        setTab(next);
        props.onTabChange?.(next);
    };

    const body = (
        <ShareBody
            props={props}
            copyRef={copyRef}
            regenerating={regenerating}
            onRegenerateNow={() => onRegenerateNow?.()}
        />
    );

    if (!canManage || members === undefined || onInvite === undefined) {
        return body;
    }

    return (
        <Tabs<ShareTab>
            value={tab}
            onValueChange={changeTab}
            fullWidth
            aria-label={t('Invitation method')}
            items={[
                { value: 'link', label: t('Link & QR') },
                {
                    value: 'members',
                    label: t('Members'),
                    count: members.filter((member) => !member.inSession).length,
                },
            ]}
        >
            <TabsContent value="link">{body}</TabsContent>
            <TabsContent value="members">
                <MembersPanel
                    members={members}
                    defaultRole={invite.defaultRole ?? 'participant'}
                    onInvite={onInvite}
                />
            </TabsContent>
        </Tabs>
    );
}

/** The members listbox closes on Escape before the dialog that hosts it. */
function keepOpenWhileListboxOpen(event: globalThis.KeyboardEvent): void {
    const target = event.target;

    if (
        target instanceof HTMLElement &&
        target.getAttribute('role') === 'combobox' &&
        target.getAttribute('aria-expanded') === 'true' &&
        target.closest('[data-slot="share-members"]') !== null
    ) {
        event.preventDefault();
    }
}

export function ShareDialog(props: ShareDialogProps) {
    const { t } = useTrans();
    const {
        open,
        onOpenChange,
        session,
        invite,
        canManage,
        isMobile = false,
        onRegenerate,
    } = props;
    const copyRef = useRef<HTMLButtonElement>(null);
    const regenerateRef = useRef<HTMLButtonElement>(null);
    const openerRef = useRef<HTMLElement | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [tab, setTab] = useState<ShareTab>(props.tab ?? 'link');
    const [previousTabProp, setPreviousTabProp] = useState(props.tab);

    if (props.tab !== previousTabProp) {
        setPreviousTabProp(props.tab);

        if (props.tab !== undefined) {
            setTab(props.tab);
        }
    }

    const isExpired = invite.status === 'expired';
    const canRegenerate =
        canManage &&
        onRegenerate !== undefined &&
        invite.allowGuests &&
        invite.url !== null &&
        !isExpired;

    const regenerateNow = async (): Promise<void> => {
        if (!onRegenerate) {
            return;
        }

        setRegenerating(true);

        try {
            await onRegenerate();
        } catch {
            return;
        } finally {
            setRegenerating(false);
        }
    };

    const changeTab = (next: ShareTab): void => {
        setTab(next);
        props.onTabChange?.(next);
    };

    const description = [
        session.teamName,
        session.presentCount === undefined
            ? undefined
            : session.presentCount === 1
              ? t('1 present')
              : t(':count present', { count: session.presentCount }),
    ]
        .filter((part) => part !== undefined && part !== '')
        .join(' · ');

    const content = (
        <ShareDialogContent
            {...props}
            tab={tab}
            onTabChange={changeTab}
            copyRef={copyRef}
            regenerating={regenerating}
            onRegenerateNow={() => void regenerateNow()}
        />
    );

    const title = t('Invite to :title', { title: session.title });
    // Without a team or a count there is nothing to add to the title.
    const withoutDescription =
        description === '' ? { 'aria-describedby': undefined } : {};

    const confirm = canRegenerate && (
        <ConfirmDialog
            open={confirmOpen}
            onOpenChange={(next) => {
                setConfirmOpen(next);

                if (!next) {
                    window.setTimeout(() => regenerateRef.current?.focus(), 0);
                }
            }}
            tone="destructive"
            confirmIcon={RefreshCw}
            title={t('Regenerate the invite link?')}
            description={t(
                'Creating a new link signs out every guest who joined with the old one.',
            )}
            consequences={[
                {
                    icon: Link2Off,
                    label: t('The old link and its QR code stop working.'),
                },
            ]}
            confirmLabel={t('Regenerate')}
            onConfirm={async () => {
                await onRegenerate?.();
            }}
        />
    );

    const regenerateButton = canRegenerate && (
        <Button
            ref={regenerateRef}
            type="button"
            variant="ghost"
            disabled={regenerating}
            onClick={() => setConfirmOpen(true)}
            className="max-w-full sm:mr-auto"
        >
            <RefreshCw aria-hidden />
            <span className="truncate">{t('Regenerate link')}</span>
        </Button>
    );

    const focusCopy = (event: Event): void => {
        // The focus has not moved into the dialog yet: it is still on
        // whatever opened it.
        openerRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

        if (!copyRef.current) {
            return;
        }

        event.preventDefault();
        copyRef.current.focus();
    };

    const restoreOpenerFocus = (event: Event): void => {
        event.preventDefault();

        if (openerRef.current?.isConnected) {
            openerRef.current.focus();
        }
    };

    if (isMobile) {
        return (
            <>
                <Drawer open={open} onOpenChange={onOpenChange}>
                    <DrawerContent
                        closeLabel={t('Close')}
                        onOpenAutoFocus={focusCopy}
                        onCloseAutoFocus={restoreOpenerFocus}
                        onEscapeKeyDown={keepOpenWhileListboxOpen}
                        {...withoutDescription}
                        data-slot="share-dialog"
                        className="overflow-y-auto"
                    >
                        <DrawerHeader>
                            <DrawerTitle
                                className="truncate px-8"
                                title={title}
                            >
                                {title}
                            </DrawerTitle>
                            {description !== '' && (
                                <DrawerDescription className="truncate">
                                    {description}
                                </DrawerDescription>
                            )}
                        </DrawerHeader>
                        {content}
                        {regenerateButton}
                    </DrawerContent>
                </Drawer>
                {confirm}
            </>
        );
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    closeLabel={t('Close')}
                    onOpenAutoFocus={focusCopy}
                    onCloseAutoFocus={restoreOpenerFocus}
                    onEscapeKeyDown={keepOpenWhileListboxOpen}
                    {...withoutDescription}
                    data-slot="share-dialog"
                    className="sm:max-w-128"
                >
                    <DialogHeader>
                        <DialogTitle className="truncate pr-8" title={title}>
                            {title}
                        </DialogTitle>
                        {description !== '' && (
                            <DialogDescription className="truncate">
                                {description}
                            </DialogDescription>
                        )}
                    </DialogHeader>
                    {content}
                    {canManage && (
                        <DialogFooter>
                            {regenerateButton}
                            <Button
                                type="button"
                                onClick={() => onOpenChange(false)}
                            >
                                <span className="truncate">{t('Done')}</span>
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
            {confirm}
        </>
    );
}
