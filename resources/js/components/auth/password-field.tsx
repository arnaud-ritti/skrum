import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';
import { TextField } from '@/components/skrum/text-field';
import type { TextFieldProps } from '@/components/skrum/text-field';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'suffix'> & {
    passwordrules?: string;
};

export function PasswordField({ id, disabled, ...props }: PasswordFieldProps) {
    const { t } = useTrans();
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const [visible, setVisible] = useState(false);

    return (
        <TextField
            {...props}
            id={fieldId}
            disabled={disabled}
            type={visible ? 'text' : 'password'}
            suffix={
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    data-slot="password-toggle"
                    aria-controls={fieldId}
                    aria-label={
                        visible ? t('Hide password') : t('Show password')
                    }
                    disabled={disabled}
                    className="-mr-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setVisible((shown) => !shown)}
                >
                    {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </Button>
            }
        />
    );
}
