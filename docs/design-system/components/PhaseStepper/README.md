Stepper des phases de la rétro : Icebreaker → Écriture → Regroupement → Vote → Discussion → Actions → ROTI.

## Quand l'utiliser
- En haut du board de rétro, pour tous. Cliquable pour le facilitateur, lecture seule pour les participants.
- Version compacte dans la topbar quand la largeur manque ; version mobile « Phase 4/7 » + barre de progression.

## Anatomie
Rail pilule (`sk-phases`) · étapes (`sk-phase`) : numéro ou coche, libellé · séparateurs (`sk-phase-link`) · étape courante pleine `--primary` · étapes faites avec coche `--skrum-success-*` · en compact, seuls le numéro/coche des autres étapes restent visibles.

## Props
```ts
type RetroPhase = "icebreaker" | "writing" | "grouping" | "voting" | "discussion" | "actions" | "roti";

interface PhaseStepperProps {
  phases: { id: RetroPhase; label: string; skipped?: boolean }[];
  current: RetroPhase;
  interactive?: boolean;            // true = facilitateur
  compact?: boolean;
  onPhaseChange?: (phase: RetroPhase) => void; // demande une confirmation si on revient en arrière
}
```

## États
phase 2 active · phase 4 active · survol d'une étape (facilitateur, fond `--accent`) · compact · participant lecture seule (pas de pointeur, mention « Camille pilote les phases ») · phase sautée (libellé barré, `--muted-foreground`) · mobile.

## Accessibilité & clavier
- Participant : `<ol>` dans `<nav aria-label="Phases de la rétro">`, étape courante `aria-current="step"`.
- Facilitateur : boutons ; <kbd>←</kbd>/<kbd>→</kbd> parcourent (roving tabindex), <kbd>Entrée</kbd> sélectionne ; raccourci global <kbd>⌘/Ctrl</kbd>+<kbd>→</kbd> phase suivante.
- Compact : chaque bouton garde un `aria-label` complet (« Discussion »).
- Changement de phase annoncé via `aria-live="polite"` (« Phase Vote »).

## Temps réel
- `PhaseChanged {phase, startedAt, timer?}` sur `presence-retro.{sessionId}` ; tous les clients basculent ensemble avec `sk-enter`.
- Seul le rôle facilitateur est autorisé (policy Laravel) ; un participant ne peut pas émettre.
- À la reconnexion, l'état courant est relu via Inertia `router.reload({ only: ["phase"] })`.

## À faire / À éviter
- Faire : garder les 7 libellés courts, identiques partout (écrans, e-mails, exports).
- Éviter : laisser un participant penser qu'il peut cliquer (pas de survol en lecture seule).
- Éviter : revenir en arrière sans confirmation (les votes peuvent être réinitialisés).

## Tokens
`--card` `--border` `--primary` `--primary-foreground` `--muted` `--muted-foreground` `--foreground` `--accent` `--accent-foreground` `--skrum-success-soft` `--skrum-success-text` `--skrum-primary-soft` `--skrum-primary-text` `--shadow-card` `--radius-full` `--space-2`
