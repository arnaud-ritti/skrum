Barre flottante du facilitateur : timer, révéler/masquer les cartes, verrouiller le board, focus sur une carte, phase suivante.

## Quand l'utiliser
- Visible uniquement pour le rôle facilitateur (et co-facilitateurs), en bas du board, centrée, au-dessus du canevas (`--z-chrome`).
- Mobile : version compacte à icônes + menu « … ».

## Anatomie
Badge de rôle · `Timer` + pause · séparateur · bascule « Révéler les cartes / Masquer » · bascule « Verrouiller / Board verrouillé » · focus (bouton cible ou pastille « Focus : … » avec ✕ et « carte suivante ») · séparateur · bouton principal nommant la phase suivante.

## Props
```ts
interface FacilitatorBarProps {
  phase: RetroPhase;
  nextPhase?: { id: RetroPhase; label: string };
  timer?: { remainingMs: number; totalMs: number; paused: boolean };
  cardsRevealed: boolean;
  boardLocked: boolean;
  focusedCard?: { id: string; excerpt: string } | null;
  compact?: boolean;
  onTimerStart?: (durationMs: number) => void;
  onTimerToggle?: () => void;
  onTimerAdd?: (ms: number) => void;
  onRevealToggle?: () => void;
  onLockToggle?: () => void;
  onFocusCard?: (cardId: string | null) => void;
  onFocusNext?: () => void;
  onNextPhase?: () => void;
}
```

## États
défaut (écriture, cartes masquées) · board verrouillé (bouton `--skrum-warning-soft`, message d'aide sous la barre) · cartes révélées (bascule `aria-pressed`, fond `--skrum-primary-soft`) · focus sur une carte (pastille `--skrum-info-soft`) · timer bas (< 1 min) · menu du timer (durées 3/5/10 min, +1 min, arrêter) · compact mobile.

## Accessibilité & clavier
- `role="toolbar"` + `aria-label="Outils du facilitateur"`, navigation <kbd>←</kbd>/<kbd>→</kbd> entre contrôles.
- Bascules : `aria-pressed`. Libellé qui change avec l'état (« Masquer » / « Révéler les cartes »).
- Raccourcis : <kbd>R</kbd> révéler/masquer · <kbd>L</kbd> verrouiller · <kbd>F</kbd> focus sur la carte sélectionnée · <kbd>T</kbd> démarrer/pause timer · <kbd>⌘/Ctrl</kbd>+<kbd>→</kbd> phase suivante.
- Les actions globales (verrouiller, révéler) sont annoncées aux participants par `aria-live` côté board.

## Temps réel
- Émissions (HTTP → broadcast Reverb sur `presence-retro.{sessionId}`) : `CardsRevealed`, `CardsHidden`, `BoardLocked`, `BoardUnlocked`, `CardFocused {cardId|null}`, `TimerStarted {endsAt}`, `TimerPaused {remainingMs}`, `PhaseChanged`.
- Le timer est horodaté côté serveur (`endsAt`) ; chaque client calcule le reste localement (pas de tick diffusé).
- Focus : tous les clients défilent vers la carte et l'entourent (`is-focused`).

## Mapping shadcn
`Button` (`variant="outline" size="sm"`), `Toggle` pour les bascules (`data-[state=on]:bg-(--skrum-primary-soft)`), `DropdownMenu` pour le timer, `Tooltip` sur les boutons icône, `Separator orientation="vertical"`. Conteneur : `bg-popover border rounded-xl shadow-(--shadow-raised) p-1.5`.

## À faire / À éviter
- Faire : nommer la phase suivante sur le bouton principal (« Regroupement → »).
- Faire : confirmer avant de révéler si moins de 50 % des participants ont écrit.
- Éviter : l'afficher aux participants ; y ajouter des actions rares (elles vont dans le menu « … »).

## Tokens
`--popover` `--border` `--primary` `--skrum-primary-soft` `--skrum-primary-text` `--skrum-warning-soft` `--skrum-warning-text` `--skrum-info-soft` `--skrum-info-text` `--muted-foreground` `--shadow-raised` `--radius-xl` `--radius-md` `--z-chrome` `--space-2`
