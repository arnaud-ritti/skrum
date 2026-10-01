Widget ROTI (Return On Time Invested) : vote de 1 à 5 en fin de réunion, puis résultat agrégé avec moyenne et distribution.

## Quand l'utiliser
- Dernière phase de la rétro (et optionnellement fin de poker/atelier). Une seule question, fixe.
- L'historique sprint après sprint est affiché par `MoodTrendChart`.

## Anatomie
Vote : question · 5 options (`sk-roti-opt`) : pastille numérotée couleur `--skrum-roti-N` (chiffre en `--skrum-roti-foreground`) + libellé (1 Perte de temps · 2 Peu utile · 3 Correct · 4 Utile · 5 Excellent) · confirmation « Vote enregistré ». Résultat : moyenne en grand « 3,8 / 5 », tendance vs sprint précédent, barre empilée de répartition, lignes par note (pastille, libellé, barre, effectif), votants manquants + « Clôturer le ROTI ».

## Props
```ts
type Roti = 1 | 2 | 3 | 4 | 5;

interface ROTIWidgetProps {
  mode: "vote" | "result";
  value?: Roti | null;
  onVote?: (v: Roti) => void;
  result?: {
    mean: number;
    votes: number;
    distribution: Record<Roti, number>;
    previousMean?: number;
    missing?: Participant[];
  };
  canClose?: boolean;               // facilitateur
  onClose?: () => void;
}
```

## États
aucune sélection · survol · sélectionné (liseré `--foreground`) · envoyé (message `--skrum-success-*`, modifiable jusqu'à la clôture) · résultat agrégé · attente des derniers votants.

## Accessibilité & clavier
- `role="radiogroup"` + `aria-labelledby` ; <kbd>1</kbd>–<kbd>5</kbd> votent directement, <kbd>←</kbd>/<kbd>→</kbd> changent.
- Le chiffre est toujours visible sur la couleur (règle token) ; libellé texte sous chaque note.
- Barre empilée `role="img"` + `aria-label` ; les lignes détaillées portent l'info en texte.

## Temps réel
- `RotiVoteCast {count}` sur `presence-retro.{sessionId}` (compteur seulement, vote anonyme).
- `RotiClosed {mean, distribution}` affiche le résultat pour tous et l'ajoute à l'historique d'équipe (`MoodTrendChart`).

## À faire / À éviter
- Faire : toujours montrer chiffre + libellé ; comparer au sprint précédent.
- Éviter : révéler qui a voté quoi ; utiliser les couleurs ROTI hors du contexte ROTI/humeur.

## Tokens
`--skrum-roti-1…5` `--skrum-roti-foreground` `--card` `--border` `--foreground` `--muted` `--muted-foreground` `--accent` `--skrum-success-soft` `--skrum-success-text` `--font-display` `--radius` `--radius-full` `--shadow-card` `--space-3` `--space-4` `--space-5`
