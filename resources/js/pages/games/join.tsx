import { Form, Head } from '@inertiajs/react';
import GameJoinsController from '@/actions/App/Http/Controllers/GameJoinsController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';

type Props =
    | { isInvalid: true }
    | {
          isInvalid: false;
          guestToken: string;
          roomName: string | null;
          gameLabel: string;
          suggestedName: string;
      };

export default function JoinGameRoom(props: Props) {
    const { t } = useTrans();

    if (props.isInvalid) {
        return (
            <>
                <Head title={t('Join a game')} />
                <Heading
                    title={t('Join a game')}
                    description={t('This guest link is no longer valid.')}
                />
            </>
        );
    }

    return (
        <>
            <Head title={props.roomName ?? t('Join a game')} />
            <div className="space-y-6">
                <Heading
                    title={props.roomName ?? t('Join a game')}
                    description={t(
                        'You are invited to play :game. Choose the name other players will see.',
                        { game: props.gameLabel },
                    )}
                />
                <Form
                    {...GameJoinsController.store.form(props.guestToken)}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">
                                    {t('Display name')}
                                </Label>
                                <Input
                                    id="name"
                                    name="name"
                                    required
                                    maxLength={50}
                                    autoFocus
                                    defaultValue={props.suggestedName}
                                />
                                <InputError message={errors.name} />
                            </div>
                            <Button className="w-full" disabled={processing}>
                                {t('Join')}
                            </Button>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}
