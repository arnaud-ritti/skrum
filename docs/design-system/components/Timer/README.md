Minuteur de phase : temps restant en chiffres monospace avec anneau de progression, partagé par toute la session.

## Quand l'utiliser
- Phases chronométrées (Écriture, Vote, jeux d'icebreaker, votes de poker), dans la `FacilitatorBar` et la topbar des participants.
- Grand format (`lg`) en mode présentation / écran partagé.

## Anatomie
Pastille (`sk-timer`, fond `--muted`) · anneau conique (`--p` = fraction restante) ou icône d'état · chiffres `mm:ss` en `--font-mono` tabulaires · contrôles facilitateur à côté (pause, +1 min, réinitialiser).

## Props
```ts
interface TimerProps {
  endsAt: string | null;            // ISO, horloge serveur
  totalMs: number;
  pausedRemainingMs?: number | null;// non null = en pause
  size?: "md" | "lg";
  lowThresholdMs?: number;          // défaut 60 000
  controls?: boolean;               // facilitateur
  onPause?: () => void;
  onResume?: () => void;
  onAdd?: (ms: number) => void;
  onReset?: () => void;
  onDone?: () => void;
}
```

## États
normal · moins d'une minute (`is-low`, fond `--skrum-warning`) · terminé (`is-done`, fond `--destructive`, icône réveil, secousse `sk-nudge` ×2 puis fixe) · en pause (icône pause, chiffres `--muted-foreground`) · grand format.

## Accessibilité & clavier
- `role="timer"` avec `aria-label` en toutes lettres (« 4 minutes 32 restantes ») mis à jour chaque minute, pas chaque seconde.
- Annonces `aria-live="assertive"` uniquement à 60 s, 10 s et 0.
- Facilitateur : <kbd>T</kbd> pause/reprise, <kbd>+</kbd> ajoute 1 min.
- Couleur doublée par l'icône et l'annonce ; `prefers-reduced-motion` supprime la secousse.

## Temps réel
- `TimerStarted {endsAt, totalMs}`, `TimerPaused {remainingMs}`, `TimerResumed {endsAt}`, `TimerExtended {endsAt}` sur `presence-retro.{sessionId}` (ou `presence-poker.{id}`).
- Chaque client corrige l'écart d'horloge avec l'offset serveur reçu à la connexion Echo ; aucun tick diffusé.
- À 0, le serveur n'agit pas automatiquement : le facilitateur décide (sauf option « verrouiller à la fin »).

## À faire / À éviter
- Faire : chiffres tabulaires pour éviter le tremblement.
- Éviter : clignotement continu ou son par défaut (son optionnel, désactivé).
- Éviter : rouge avant 0 — l'orange signale « bientôt ».

## Tokens
`--muted` `--foreground` `--muted-foreground` `--primary` `--skrum-warning` `--skrum-warning-foreground` `--destructive` `--destructive-foreground` `--card` `--border` `--font-mono` `--radius-md` `--radius` `--radius-xl` `--shadow-card` `--space-3`
