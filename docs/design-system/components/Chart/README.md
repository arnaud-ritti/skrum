Graphiques de suivi d'équipe (barres groupées, courbes) en SVG, sur la palette catégorielle `--chart-1..5`, avec grille discrète, légende, étiquettes directes et tooltip au survol.

**Quand l'utiliser**
- Barres : comparer des quantités par période (actions créées vs terminées par sprint).
- Courbes : évolution continue sur une même unité (points engagés vs réalisés).
- Un seul chiffre → `Card` stat ; distribution d'un vote poker → `sk-dist`.

**Anatomie**
Card → en-tête (titre, légende à droite, description avec périmètre) → zone de tracé : grille horizontale `--border` 1 px, axes 11 px `--muted-foreground`, barres 18 px à coins hauts 4 px et 2 px d'écart, courbes 2 px, marqueurs 9 px détourés `--card` → survol : bande `--muted` (barres) ou ligne de visée pointillée (courbes) + tooltip `--popover` (titre, pastille + série + valeur tabulaire). Étiquettes de valeur seulement sur le point survolé/remarquable.

**Props**
```ts
import type { ChartConfig } from '@/components/ui/chart';
const actionsConfig = {
  created: { label: 'Créées', color: 'var(--chart-1)' },
  done:    { label: 'Terminées', color: 'var(--chart-2)' },
} satisfies ChartConfig;
const pointsConfig = {
  committed: { label: 'Engagé', color: 'var(--chart-3)' },
  delivered: { label: 'Réalisé', color: 'var(--chart-1)' },
} satisfies ChartConfig;
interface TeamChartProps<T> { title: string; description: string; data: T[]; config: ChartConfig; kind: 'bar' | 'line'; xKey: keyof T; unit?: string }
```

**États**
Repos, survol d'une période (bande/visée + tooltip), période en cours (S43 : courbe « Réalisé » interrompue), vide (`EmptyState` « Pas encore assez de sprints »), chargement (`Skeleton` rectangle).

**Accessibilité & clavier**
- `<svg role="img" aria-label>` résumant le graphique + tableau de données accessible (`ChartTable` ou bouton « Voir les données »).
- Identité jamais par la couleur seule : légende toujours présente, étiquettes directes pour ≤ 4 séries.
- Navigation clavier `← →` entre périodes, qui affiche le même tooltip.

**À faire / À éviter**
- Faire : couleurs dans l'ordre fixe chart-1 → chart-5, qui suivent la série (pas son rang) ; une seule échelle Y.
- Éviter : double axe, 3D, dégradés ; couleurs de statut (success/destructive) pour des séries ; valeur sur chaque point.

**Tokens**
`--chart-1` `--chart-2` `--chart-3` `--chart-4` `--chart-5` `--border` `--muted` `--muted-foreground` `--foreground` `--card` `--popover` `--popover-foreground` `--shadow-popover` `--radius-md` `--radius-xl` `--font-sans`

**Mapping shadcn**
- `@/components/ui/chart` (Recharts) : `ChartContainer config={actionsConfig} className="aspect-auto h-51 w-full"`, `ChartTooltip content={<ChartTooltipContent indicator="dot" />}`, `ChartLegend content={<ChartLegendContent />}`.
- Barres : `<BarChart data={data} barGap={2} barCategoryGap={24}><CartesianGrid vertical={false} /><XAxis dataKey="sprint" tickLine={false} axisLine={false} /><YAxis width={24} tickLine={false} axisLine={false} /><Bar dataKey="created" fill="var(--color-created)" radius={[4,4,0,0]} /><Bar dataKey="done" fill="var(--color-done)" radius={[4,4,0,0]} /></BarChart>`.
- Courbes : `<Line type="linear" dataKey="committed" stroke="var(--color-committed)" strokeWidth={2} dot={false} activeDot={{ r: 4.5, strokeWidth: 2, stroke: 'var(--card)' }} />`, `ChartTooltip cursor={{ strokeDasharray: '3 3', stroke: 'var(--muted-foreground)' }}`.
- Classes : grille `[&_.recharts-cartesian-grid_line]:stroke-border`, ticks `text-overline fill-muted-foreground`, tooltip `rounded-md border bg-popover shadow-popover`.
