Carte de jeu d'icebreaker : illustration, nom, pitch, durée et nombre de joueurs, sélectionnable avant une rétro.

## Quand l'utiliser
- Sélecteur de jeu (phase Icebreaker de la rétro, module Icebreakers). Jeux : Pendu, Dessin à deviner, Devine l'emoji, Deux vérités un mensonge.
- Grille de 2 à 4 colonnes ; 1 colonne sur mobile (illustration réduite).

## Anatomie
`sk-game` · zone illustrée (`sk-game-art`, couleur de colonne `--c`, motif du jeu en formes simples + icône lucide en coin) · corps : nom, pitch (1 ligne et demie), méta (horloge + durée, groupe + joueurs min-max) · coche de sélection en haut à droite.

## Props
```ts
type IcebreakerGame = "hangman" | "pictionary" | "emoji" | "two-truths";

interface IcebreakerGameCardProps {
  game: IcebreakerGame;
  title: string;
  pitch: string;
  color: ColumnColor;
  durationMin: number;
  players: { min: number; max: number };
  participants: number;             // pour calculer la disponibilité
  selected?: boolean;
  onSelect?: (g: IcebreakerGame) => void;
}
```

## États
défaut · survol (soulevée de 2 px, `--shadow-raised`) · sélectionné (anneau 2 px `--primary` + coche) · indisponible (opacité .55, `aria-disabled`, raison en sur-titre : « min. 3 joueurs »).

## Accessibilité & clavier
- Grille `role="radiogroup"` « Choisir un icebreaker » ; carte = `role="radio"` + `aria-checked`.
- <kbd>←</kbd>/<kbd>→</kbd>/<kbd>↑</kbd>/<kbd>↓</kbd> naviguent, <kbd>Espace</kbd> sélectionne.
- Illustration `aria-hidden` ; les emojis du jeu d'emoji ont un `aria-label` descriptif.
- Indisponible : raison lisible par `aria-describedby`.

## Temps réel
- Sélection par le facilitateur → `IcebreakerSelected {game}` sur `presence-retro.{sessionId}` ; les participants voient la carte choisie mise en avant.
- Le jeu lui-même utilise son propre canal `presence-icebreaker.{id}`.

## À faire / À éviter
- Faire : durée et joueurs toujours visibles — c'est le critère de choix.
- Éviter : personnages ou mascottes dans les illustrations ; plus de 2 lignes de pitch.

## Tokens
`--card` `--border` `--foreground` `--muted-foreground` `--primary` `--primary-foreground` `--skrum-col-{sun|sky|apricot|plum}` + `-border` + `-text` (via `sk-c-*`) `--font-display` `--radius-xl` `--shadow-card` `--shadow-raised` `--duration-fast` `--ease-standard` `--space-4`
