import { Head } from '@inertiajs/react';
import { RefreshCw } from 'lucide-react';
import {
    Component,
    Suspense,
    lazy,
    useState,
    type ComponentType,
    type ErrorInfo,
    type ReactNode,
} from 'react';
import { SessionTitle } from '@/components/session/session-title';
import { EmptyState } from '@/components/skrum/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import SessionLayout from '@/layouts/skrum/session-layout';
import type { WhiteboardSnapshot } from '@/lib/whiteboard/types';

type Props = { snapshot: WhiteboardSnapshot };

type BoardComponent = ComponentType<Props>;

const loadBoard = () => import('@/components/whiteboard/board');

/**
 * The messages browsers give when a dynamic import or its CSS fails to load
 * (Chromium, Firefox, Safari, Vite's preload helper).
 */
const ChunkLoadFailure =
    /dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

function isChunkLoadFailure(error: unknown): boolean {
    return error instanceof Error && ChunkLoadFailure.test(error.message);
}

type CanvasFailure = { failure: 'none' | 'chunk' | 'crash' };

class CanvasBoundary extends Component<
    {
        fallback: (isChunkLoadFailure: boolean) => ReactNode;
        children: ReactNode;
    },
    CanvasFailure
> {
    state: CanvasFailure = { failure: 'none' };

    static getDerivedStateFromError(error: unknown): CanvasFailure {
        return { failure: isChunkLoadFailure(error) ? 'chunk' : 'crash' };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(
            'whiteboard: the canvas failed',
            error,
            info.componentStack,
        );
    }

    render() {
        return this.state.failure === 'none'
            ? this.props.children
            : this.props.fallback(this.state.failure === 'chunk');
    }
}

/** The frame of the board while its canvas is not there: loading, or failed. */
function BoardFrame({
    title,
    teamUrl,
    children,
}: {
    title: string;
    teamUrl: string | null;
    children: ReactNode;
}) {
    return (
        <SessionLayout
            chrome="logo"
            homeHref={teamUrl}
            title={<SessionTitle>{title}</SessionTitle>}
        >
            {children}
        </SessionLayout>
    );
}

function CanvasError({
    isChunkLoadFailure,
    onRetry,
}: {
    isChunkLoadFailure: boolean;
    onRetry: () => void;
}) {
    const { t } = useTrans();

    return (
        <div className="flex h-full items-center justify-center overflow-y-auto p-6">
            <EmptyState
                module="whiteboard"
                title={t('The canvas could not be loaded.')}
                description={
                    isChunkLoadFailure
                        ? t('Check your connection, then try again.')
                        : t('Something went wrong. Please try again.')
                }
                action={{
                    label: t('Retry'),
                    icon: RefreshCw,
                    variant: 'outline',
                    onClick: onRetry,
                }}
            />
        </div>
    );
}

export default function ShowWhiteboard({ snapshot }: Props) {
    const [attempt, setAttempt] = useState(0);
    const [Board, setBoard] = useState<BoardComponent>(() => lazy(loadBoard));
    const { title } = snapshot.board;

    const retry = () => {
        setBoard(() => lazy(loadBoard));
        setAttempt((current) => current + 1);
    };

    return (
        <>
            <Head title={title} />
            <CanvasBoundary
                key={attempt}
                fallback={(isChunkLoadFailure) => (
                    <BoardFrame title={title} teamUrl={snapshot.links.team}>
                        <CanvasError
                            isChunkLoadFailure={isChunkLoadFailure}
                            onRetry={retry}
                        />
                    </BoardFrame>
                )}
            >
                <Suspense
                    fallback={
                        <BoardFrame title={title} teamUrl={snapshot.links.team}>
                            <Skeleton className="size-full rounded-none" />
                        </BoardFrame>
                    }
                >
                    <Board snapshot={snapshot} />
                </Suspense>
            </CanvasBoundary>
        </>
    );
}
