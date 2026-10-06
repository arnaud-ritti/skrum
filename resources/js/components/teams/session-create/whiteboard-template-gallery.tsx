import { useId } from 'react';
import type { ReactElement } from 'react';
import { WhiteboardTemplatePreview } from '@/components/teams/whiteboard-template-preview';
import { RadioGroup, RadioGroupCardItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardGalleryItem } from '@/types';

type WhiteboardTemplateGalleryProps = {
    items: WhiteboardGalleryItem[];
    /** Key of the chosen item. */
    value: string;
    onValueChange: (key: string) => void;
    loading?: boolean;
    error?: string;
};

const SkeletonTiles = 6;

/** Inside a form, Radix puts a hidden input after each radio: it is a grid item too, so it is taken out. */
const grid =
    'grid grid-cols-1 gap-3 @xs/templates:grid-cols-2 [&>input]:hidden';

function Tile({ item }: { item: WhiteboardGalleryItem }) {
    return (
        <RadioGroupCardItem value={item.key} className="p-2">
            <WhiteboardTemplatePreview preview={item.preview} />
            <span className="flex min-w-0 flex-col gap-0.5 px-1 pb-1">
                <span className="text-sm font-medium break-words">
                    {item.name}
                </span>
                {item.description !== null && item.description !== '' && (
                    <span className="text-xs break-words text-muted-foreground">
                        {item.description}
                    </span>
                )}
            </span>
        </RadioGroupCardItem>
    );
}

/**
 * The templates a whiteboard starts from: the built-in ones, then the ones of
 * the workspace under their own heading. Each list is a radiogroup; one tile
 * is checked across both.
 */
export function WhiteboardTemplateGallery({
    items,
    value,
    onValueChange,
    loading = false,
    error,
}: WhiteboardTemplateGalleryProps): ReactElement {
    const { t } = useTrans();
    const headingId = useId();
    const errorId = useId();
    const builtIns = items.filter((item) => item.workspaceTemplateId === null);
    const workspaceTemplates = items.filter(
        (item) => item.workspaceTemplateId !== null,
    );
    const describedBy = error === undefined ? undefined : errorId;

    return (
        <div
            data-slot="whiteboard-template-gallery"
            className="@container/templates flex min-w-0 flex-col gap-3"
        >
            {loading && (
                <div aria-busy="true" className={grid}>
                    <span className="sr-only" role="status">
                        {t('Loading templates…')}
                    </span>
                    {Array.from({ length: SkeletonTiles }, (_, index) => (
                        <Skeleton
                            key={index}
                            aria-hidden
                            className="h-40 rounded-lg"
                        />
                    ))}
                </div>
            )}
            {!loading && (
                <RadioGroup
                    aria-label={t('Template')}
                    aria-describedby={describedBy}
                    value={value}
                    onValueChange={onValueChange}
                    className={grid}
                >
                    {builtIns.map((item) => (
                        <Tile key={item.key} item={item} />
                    ))}
                </RadioGroup>
            )}
            {!loading && workspaceTemplates.length > 0 && (
                <>
                    <p
                        id={headingId}
                        className="truncate text-xs font-semibold text-muted-foreground"
                    >
                        {t('Workspace templates')}
                    </p>
                    <RadioGroup
                        aria-labelledby={headingId}
                        aria-describedby={describedBy}
                        value={value}
                        onValueChange={onValueChange}
                        className={grid}
                    >
                        {workspaceTemplates.map((item) => (
                            <Tile key={item.key} item={item} />
                        ))}
                    </RadioGroup>
                </>
            )}
            {error !== undefined && (
                <p
                    id={errorId}
                    role="alert"
                    className="text-xs text-skrum-destructive-text"
                >
                    {error}
                </p>
            )}
        </div>
    );
}
