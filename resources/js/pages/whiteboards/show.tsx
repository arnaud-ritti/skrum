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

class ChunkBoundary extends Component<
    { fallback: ReactNode; children: ReactNode },
    { failed: boolean }
> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(
            'whiteboard: the canvas failed',
            error,
            info.componentStack,
        );
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}

/** The frame of the board while its canvas is not there: loading, or failed. */
function BoardFrame({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <SessionLayout title={<SessionTitle>{title}</SessionTitle>}>
            {children}
        </SessionLayout>
    );
}

function CanvasError({ onRetry }: { onRetry: () => void }) {
    const { t } = useTrans();

    return (
        <div className="flex h-full items-center justify-center overflow-y-auto p-6">
            <EmptyState
                module="whiteboard"
                title={t('The canvas could not be loaded.')}
                description={t('Check your connection, then try again.')}
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
            <ChunkBoundary
                key={attempt}
                fallback={
                    <BoardFrame title={title}>
                        <CanvasError onRetry={retry} />
                    </BoardFrame>
                }
            >
                <Suspense
                    fallback={
                        <BoardFrame title={title}>
                            <Skeleton className="size-full rounded-none" />
                        </BoardFrame>
                    }
                >
                    <Board snapshot={snapshot} />
                </Suspense>
            </ChunkBoundary>
        </>
    );
}
