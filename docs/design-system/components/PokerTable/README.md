Table de planning poker : participants autour d'une table ovale, suivi des votes, puis révélation avec moyenne, médiane, consensus ou dispersion et distribution.

## Quand l'utiliser
- Écran principal d'une session de poker, story courante au centre de la table.
- Le panneau « Résultat » peut aussi vivre seul (historique des estimations, export).

## Anatomie
Grille 3×3 : sièges en haut (carte près de la table, nom et état au-dessus), gauche, droite, en bas · table (`sk-ptable`, sauge) avec story, progression et « Révéler » (facilitateur) · après révélation : moyenne au centre, badge « À discuter » / « Consensus », cartes aberrantes cerclées `--skrum-warning`. Panneau résultat : `sk-stat` (moyenne, médiane, accord), `sk-dist` (barre pleine = mode), phrase d'aide, actions (Revoter, Retenir, Valider, Story suivante).

## Props
```ts
interface PokerSeat {
  user: Participant;
  state: "waiting" | "voted" | "absent";
  value?: PokerValue;               // après révélation seulement
}

interface PokerTableProps {
  story: { key?: string; title: string; url?: string };
  seats: PokerSeat[];
  revealed: boolean;
  result?: {
    mean: number | null;            // hors "?" et "☕"
    median: number | null;
    mode: PokerValue;
    agreement: number;              // part des votes = mode (0..1)
    consensus: boolean;             // agreement ≥ 0.75 et écart ≤ 1 cran
    distribution: { value: PokerValue; count: number }[];
    outliers: string[];             // userIds min/max à écouter
  };
  isFacilitator?: boolean;
  onReveal?: () => void;
  onRevote?: () => void;
  onAccept?: (value: PokerValue) => void;
  onNext?: () => void;
}
```

## États
vote en cours (a voté : dos de carte + « a voté » `--skrum-success-text` ; n'a pas voté : emplacement vide + tréma « réfléchit » ; absent) · révélé dispersion forte (aberrants cerclés, badge warning) · révélé consensus (badge succès, carte retenue) · ☕ (exclu des calculs).

## Accessibilité & clavier
- Table `aria-label` avec la story ; chaque siège annonce « Camille, a voté ».
- Progression `aria-live="polite"` (« 5 sur 8 ont voté »).
- Distribution : `role="img"` + `aria-label` complet ; bouton « Voir en tableau » pour les lecteurs d'écran.
- Facilitateur : <kbd>R</kbd> révéler, <kbd>N</kbd> story suivante, <kbd>⌘/Ctrl</kbd>+<kbd>↵</kbd> valider.

## Temps réel
- `presence-poker.{sessionId}` : `.here/.joining/.leaving` placent les sièges ; `VoteCast {userId}` passe un siège à « a voté » sans valeur.
- `VotesRevealed {votes, result}` : le serveur calcule moyenne/médiane/consensus (source unique), les clients animent.
- `StoryChanged`, `RoundReset`, `EstimateAccepted {storyKey, value}` → synchronisé vers Jira/Linear (champ story points).

## À faire / À éviter
- Faire : inviter les extrêmes à s'exprimer (« Yuki (21) et Lucas (3) expliquent… »).
- Éviter : afficher la moyenne avant la révélation ; compter « ? » et « ☕ » dans les calculs ; plus de 12 sièges (au-delà, grille de sièges sans table).

## Tokens
`--secondary` `--secondary-foreground` `--card` `--foreground` `--muted-foreground` `--skrum-success-text` `--skrum-success-soft` `--skrum-warning` `--skrum-warning-soft` `--skrum-warning-text` `--chart-1` `--muted` `--primary` `--font-display` `--radius-full` `--radius-xl` `--shadow-card` `--space-3` `--space-6` `--space-8`
