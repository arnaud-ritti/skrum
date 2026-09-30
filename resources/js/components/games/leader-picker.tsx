import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { GamePlayer } from '@/lib/games/types';

type Props = {
    players: GamePlayer[];
    value: string | null;
    onChange: (playerId: string) => void;
    label: string;
};

export function LeaderPicker({ players, value, onChange, label }: Props) {
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <Select value={value ?? undefined} onValueChange={onChange}>
                <SelectTrigger className="w-48" aria-label={label}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {players.map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                            {player.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
