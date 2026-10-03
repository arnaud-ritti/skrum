import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import RetroWritersController from '@/actions/App/Http/Controllers/Retros/RetroWritersController';
import { useBoard } from '@/components/retro/board-context';
import {
    ActivityRefreshMs,
    applyActivity,
    kindsShownIn,
    liveActivity,
    othersWriting,
    parseActivity,
    WritingCountTtlMs,
    WritingHeartbeatMs,
    type ActivityEntry,
    type ActivityKind,
    type WritingCount,
} from '@/lib/retro/activity';
import { retroRequest } from '@/lib/retro/api';
import { whisperTransport } from '@/lib/realtime/whisper-transport';

export type RetroActivity = {
    entries: ActivityEntry[];
    /** Others writing on an anonymous retro in Writing; 0 elsewhere. */
    writingCount: number;
    announce: (kind: ActivityKind, targetId: string) => void;
    end: (kind: ActivityKind, targetId: string) => void;
};

const TickMs = 1000;

type Sender = { send(message: unknown): void };

/**
 * Who is writing, moving a card or taking notes (spec §6.9): client events
 * on the presence channel, the sender stamped by Reverb. On an anonymous
 * retro writing is a heartbeat to the server instead, and the board only
 * learns how many write (§6.11).
 */
export function useRetroActivity(): RetroActivity {
    const { board, online, presence, subscribeWritingCount } = useBoard();
    const { phase, isAnonymous, id: retroId } = board.retro;
    const viewerId = board.viewer.participantId;
    const countsWriters = isAnonymous && phase === 'writing';
    const [entries, setEntries] = useState<ActivityEntry[]>([]);
    const [last, setLast] = useState<WritingCount | null>(null);
    /** When the viewer's last writing heartbeat left; null while not writing. */
    const [heartbeatSentAt, setHeartbeatSentAt] = useState<number | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [trackedPhase, setTrackedPhase] = useState(phase);
    const sender = useRef<Sender | null>(null);
    /** When each announced `kind:targetId` was last sent. */
    const sentAt = useRef(new Map<string, number>());
    const heartbeatAt = useRef(0);
    const writing = useRef(false);
    const latest = useRef({
        online,
        phase,
        isAnonymous,
        viewerId,
        retroId,
        countsWriters,
    });

    if (trackedPhase !== phase) {
        setTrackedPhase(phase);
        setEntries([]);
        setLast(null);
        setHeartbeatSentAt(null);
    }

    useEffect(() => {
        latest.current = {
            online,
            phase,
            isAnonymous,
            viewerId,
            retroId,
            countsWriters,
        };
    });

    const stopWriting = useCallback(() => {
        if (!writing.current) {
            return;
        }

        writing.current = false;
        heartbeatAt.current = 0;
        setHeartbeatSentAt(null);

        void retroRequest<{ count: number }>(
            RetroWritersController.destroy(latest.current.retroId),
        ).then(
            (response) => {
                if (latest.current.countsWriters) {
                    setLast({ count: response.count, receivedAt: Date.now() });
                }
            },
            () => {},
        );
    }, []);

    const heartbeat = useCallback(() => {
        const sentNow = Date.now();

        if (
            writing.current &&
            sentNow - heartbeatAt.current < WritingHeartbeatMs
        ) {
            return;
        }

        writing.current = true;
        heartbeatAt.current = sentNow;
        setHeartbeatSentAt(sentNow);

        // A refused heartbeat (429, network) is left to the next one.
        void retroRequest<{ count: number }>(
            RetroWritersController.update(latest.current.retroId),
        ).then(
            (response) => {
                if (writing.current && latest.current.countsWriters) {
                    setLast({ count: response.count, receivedAt: Date.now() });
                    setNow(Date.now());
                }
            },
            () => {},
        );
    }, []);

    const endAll = useCallback(() => {
        for (const key of sentAt.current.keys()) {
            const [kind, ...target] = key.split(':');

            sender.current?.send({
                kind,
                targetId: target.join(':'),
                active: false,
            });
        }

        sentAt.current.clear();
        stopWriting();
    }, [stopWriting]);

    useEffect(() => {
        if (!presence) {
            sender.current = null;

            return;
        }

        const transport = whisperTransport(
            presence,
            'activity',
            (senderId) =>
                senderId !== latest.current.viewerId &&
                latest.current.online.some((member) => member.id === senderId),
        );

        sender.current = transport;

        const stop = transport.onMessage((raw, senderId) => {
            const message = parseActivity(raw);
            const { phase: current, isAnonymous: anonymous } = latest.current;

            if (!message || !senderId) {
                return;
            }

            if (!kindsShownIn(current, anonymous).includes(message.kind)) {
                return;
            }

            setEntries((previous) =>
                applyActivity(previous, senderId, message, Date.now()),
            );
        });

        return () => {
            stop();

            if (sender.current === transport) {
                sender.current = null;
            }
        };
    }, [presence]);

    // Leaving a phase, or the board, ends whatever was announced in it.
    useEffect(() => endAll, [phase, isAnonymous, endAll]);

    useEffect(() => {
        const onPageHide = () => stopWriting();

        window.addEventListener('pagehide', onPageHide);

        return () => window.removeEventListener('pagehide', onPageHide);
    }, [stopWriting]);

    useEffect(
        () =>
            subscribeWritingCount((count) => {
                if (!latest.current.countsWriters) {
                    return;
                }

                setLast({ count, receivedAt: Date.now() });
                setNow(Date.now());
            }),
        [subscribeWritingCount],
    );

    const hasEntries = entries.length > 0;

    useEffect(() => {
        if (!hasEntries) {
            return;
        }

        const interval = window.setInterval(() => {
            setEntries((previous) => {
                const live = liveActivity(previous, Date.now());

                return live.length === previous.length ? previous : live;
            });
        }, TickMs);

        return () => window.clearInterval(interval);
    }, [hasEntries]);

    const hasCount = last !== null;

    useEffect(() => {
        if (!hasCount) {
            return;
        }

        const interval = window.setInterval(() => {
            const tick = Date.now();

            setNow(tick);
            setLast((previous) =>
                previous !== null &&
                tick - previous.receivedAt >= WritingCountTtlMs
                    ? null
                    : previous,
            );
        }, TickMs);

        return () => window.clearInterval(interval);
    }, [hasCount]);

    const announce = useCallback(
        (kind: ActivityKind, targetId: string) => {
            const current = latest.current;

            if (kind === 'writing' && current.countsWriters) {
                heartbeat();

                return;
            }

            if (
                !kindsShownIn(current.phase, current.isAnonymous).includes(kind)
            ) {
                return;
            }

            const key = `${kind}:${targetId}`;
            const sentNow = Date.now();
            const previous = sentAt.current.get(key);

            if (
                previous !== undefined &&
                sentNow - previous < ActivityRefreshMs
            ) {
                return;
            }

            sentAt.current.set(key, sentNow);
            sender.current?.send({ kind, targetId, active: true });
        },
        [heartbeat],
    );

    const end = useCallback(
        (kind: ActivityKind, targetId: string) => {
            if (kind === 'writing' && latest.current.countsWriters) {
                stopWriting();

                return;
            }

            const key = `${kind}:${targetId}`;

            if (!sentAt.current.delete(key)) {
                return;
            }

            sender.current?.send({ kind, targetId, active: false });
        },
        [stopWriting],
    );

    // The server forgets a writer 8 s after the last heartbeat: a count taken
    // after a longer pause no longer holds the viewer.
    const isCountedWriting =
        heartbeatSentAt !== null &&
        last !== null &&
        last.receivedAt - heartbeatSentAt < WritingCountTtlMs;

    return {
        entries,
        writingCount: countsWriters
            ? othersWriting(last, isCountedWriting, now)
            : 0,
        announce,
        end,
    };
}

export const ActivityContext = createContext<RetroActivity | null>(null);

const NoActivity: RetroActivity = {
    entries: [],
    writingCount: 0,
    announce: () => {},
    end: () => {},
};

export function ActivityProvider({ children }: { children: ReactNode }) {
    const activity = useRetroActivity();

    return <ActivityContext value={activity}>{children}</ActivityContext>;
}

/** Outside a board (a card shown alone) nothing is announced or shown. */
export function useActivity(): RetroActivity {
    return useContext(ActivityContext) ?? NoActivity;
}
