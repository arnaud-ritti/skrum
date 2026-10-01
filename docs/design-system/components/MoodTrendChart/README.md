Graphique de tendance : ROTI moyen sprint après sprint (S35 → S42) avec bande de dispersion, seuil « correct » et annotations, en SVG inline.

## Quand l'utiliser
- Tableau de bord d'équipe, écran de fin de rétro, rapport trimestriel.
- Une seule série (ROTI moyen) : pas de légende de séries, mais une légende des marques (ligne, bande, seuil).

## Anatomie
En-tête : titre, sous-titre (fenêtre, nombre de votants), KPI du dernier sprint + tendance, `Tabs` de période · tracé SVG : grille `--border`, axe Y en pastilles ROTI 1-5 (`--skrum-roti-N`), seuil 3 en pointillés, bande Q1–Q3 (`--chart-1` à 16 %), ligne 2 px `--chart-1`, points 4 px liserés `--card`, dernier point renforcé, annotation (trait + texte `--foreground` / `--muted-foreground`), axe X sprints · survol : ligne verticale + tooltip (moyenne, dispersion, votants) · pied : légende + « Voir en tableau ».

## Props
```ts
interface MoodPoint {
  sprint: string;                   // "S42"
  mean: number;                     // 1..5
  q1: number;
  q3: number;
  voters: number;
}

interface MoodTrendChartProps {
  team: string;
  points: MoodPoint[];
  annotations?: { sprint: string; title: string; detail?: string }[];
  threshold?: number;               // défaut 3
  range?: "4" | "8" | "all";
  onRangeChange?: (r: "4" | "8" | "all") => void;
  height?: number;                  // défaut 290
}
```

## États
défaut · survol d'un sprint (crosshair + tooltip, libellé X en gras) · période 4 / 8 / tout · peu de données (< 3 sprints : points sans ligne, message) · vue tableau.

## Accessibilité & clavier
- `<svg role="img">` avec `<title>` + `<desc>` listant toutes les valeurs.
- Focus clavier sur le tracé : <kbd>←</kbd>/<kbd>→</kbd> déplacent le crosshair d'un sprint, tooltip annoncé en `aria-live`.
- « Voir en tableau » ouvre un `<table>` équivalent ; la couleur n'est jamais seule (valeurs, pastilles numérotées).

## Temps réel
- Pas de flux continu : un `RotiClosed` sur `private-team.{teamId}` ajoute le point du sprint (entrée `sk-enter`).

## Mapping shadcn
`Card`, `Tabs` (période), `Badge`, `Tooltip` stylé comme `Popover` pour le survol, `Button variant="ghost" size="sm"` ; tracé en SVG maison (ou Recharts `ComposedChart` : `Area` pour la bande, `Line` pour la moyenne, `ReferenceLine` pour le seuil) avec `stroke="var(--chart-1)"`.

## À faire / À éviter
- Faire : une seule échelle (1-5), annoter les événements marquants, garder la grille discrète.
- Éviter : double axe, dégradés sous la courbe, étiqueter chaque point.

## Tokens
`--chart-1` `--skrum-roti-1…5` `--skrum-roti-foreground` `--card` `--popover` `--popover-foreground` `--border` `--foreground` `--muted-foreground` `--skrum-success-soft` `--skrum-success-text` `--font-display` `--font-sans` `--radius` `--radius-xl` `--shadow-card` `--shadow-popover` `--space-4` `--space-5`
