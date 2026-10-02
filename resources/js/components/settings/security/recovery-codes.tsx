import { Check, Copy, Download } from 'lucide-react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';

const RecoveryCodesFileName = 'recovery-codes.txt';

function downloadText(name: string, text: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a');

    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
}

type RecoveryCodesProps = {
    codes: string[];
    /** The codes are being fetched: a placeholder stands for them. */
    loading?: boolean;
    /** Lines of the placeholder shown while the codes are fetched. */
    placeholders?: number;
};

export function RecoveryCodes({
    codes,
    loading = false,
    placeholders = 8,
}: RecoveryCodesProps): ReactElement {
    const { t } = useTrans();
    const [copied, copy] = useClipboard();
    const text = codes.join('\n');
    const unavailable = loading || codes.length === 0;

    return (
        <div data-slot="recovery-codes" className="flex min-w-0 flex-col gap-3">
            {loading ? (
                <div
                    role="status"
                    aria-label={t('Loading recovery codes')}
                    className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-x-6 gap-y-2 rounded-lg border border-dashed border-input bg-muted p-4"
                >
                    {Array.from({ length: placeholders }, (_, index) => (
                        <Skeleton
                            key={index}
                            aria-hidden="true"
                            className="h-5 bg-muted-foreground/20"
                        />
                    ))}
                </div>
            ) : codes.length === 0 ? null : (
                <ol
                    aria-label={t('Recovery codes')}
                    className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-x-6 gap-y-2 rounded-lg border border-dashed border-input bg-muted p-4"
                >
                    {codes.map((code, index) => (
                        <li
                            key={code}
                            className="flex min-w-0 items-baseline gap-3"
                        >
                            <span
                                aria-hidden="true"
                                className="font-mono text-xs text-muted-foreground tabular-nums"
                            >
                                {String(index + 1).padStart(2, '0')}
                            </span>
                            <span className="min-w-0 font-mono text-sm font-semibold tracking-wide break-all">
                                {code}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={unavailable}
                    className="max-w-full"
                    onClick={() =>
                        downloadText(RecoveryCodesFileName, `${text}\n`)
                    }
                >
                    <Download aria-hidden="true" />
                    <span className="truncate">{t('Download .txt')}</span>
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={unavailable}
                    className="max-w-full"
                    onClick={() => void copy(text)}
                >
                    {copied === text && !unavailable ? (
                        <Check aria-hidden="true" />
                    ) : (
                        <Copy aria-hidden="true" />
                    )}
                    <span className="truncate">
                        {copied === text && !unavailable
                            ? t('Copied')
                            : t('Copy')}
                    </span>
                </Button>
            </div>
        </div>
    );
}
