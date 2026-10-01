import { Head } from '@inertiajs/react';
import {
    Component,
    Suspense,
    lazy,
    useState,
    type ComponentType,
    type ErrorInfo,
    type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
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

function CanvasError({ onRetry }: { onRetry: () => void }) {
    const { t } = useTrans();

    return (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
            <p>{t('The canvas could not be loaded.')}</p>
            <Button variant="outline" onClick={onRetry}>
                {t('Retry')}
            </Button>
        </div>
    );
}

export default function ShowWhiteboard({ snapshot }: Props) {
    const [attempt, setAttempt] = useState(0);
    const [Board, setBoard] = useState<BoardComponent>(() => lazy(loadBoard));

    const retry = () => {
        setBoard(() => lazy(loadBoard));
        setAttempt((current) => current + 1);
    };

    return (
        <>
            <Head title={snapshot.board.title} />
            <ChunkBoundary
                key={attempt}
                fallback={<CanvasError onRetry={retry} />}
            >
                <Suspense fallback={<Skeleton className="h-dvh w-full" />}>
                    <Board snapshot={snapshot} />
                </Suspense>
            </ChunkBoundary>
        </>
    );
}
