type Props = { word: string | null; label: string };

export function LeaderWord({ word, label }: Props) {
    return (
        <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </span>
            <span className="text-2xl font-semibold tracking-wide">
                {word ?? '…'}
            </span>
        </div>
    );
}
