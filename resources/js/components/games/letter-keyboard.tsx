import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

const Letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

type Props = {
    picked: string[];
    disabled: boolean;
    onPick: (letter: string) => void;
};

export function LetterKeyboard({ picked, disabled, onPick }: Props) {
    const { t } = useTrans();

    return (
        <div
            role="group"
            aria-label={t('Letters')}
            className="grid grid-cols-7 gap-1.5 sm:grid-cols-9 md:grid-cols-13"
        >
            {Letters.map((letter) => {
                const isPicked = picked.includes(letter);

                return (
                    <Button
                        key={letter}
                        type="button"
                        variant={isPicked ? 'ghost' : 'outline'}
                        className="h-10 w-full px-0 text-base uppercase"
                        disabled={disabled || isPicked}
                        aria-pressed={isPicked}
                        onClick={() => onPick(letter)}
                    >
                        {letter}
                    </Button>
                );
            })}
        </div>
    );
}
