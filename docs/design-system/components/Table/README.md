Tableau de données dense pour lister et traiter en lot les actions de rétro (tri, sélection, statut, pagination).

**Quand l'utiliser**
- Listes comparables sur plusieurs attributs (actions, membres, sessions archivées, journaux d'admin).
- Mobile : bascule en liste de `sk-action` (une ligne = une carte).
- Moins de 4 attributs → liste simple.

**Anatomie**
Card englobante → barre d'outils (recherche 32 px, filtre avec compteur, bandeau de sélection `--skrum-primary-soft` avec actions de lot) → en-têtes 12/600 muted, triables (icône `chevrons-up-down`, tri actif `arrow-up/down` + texte `--foreground`) → lignes 10×12 : case, titre 600 + source (ticket, rétro d'origine), responsable (avatar sm), statut (badge), échéance (badge destructif si en retard), priorité (`sk-prio`), menu « … » → pied : compte de sélection et pagination.

**Props**
```ts
interface ActionsTableProps {
  rows: ActionRow[];
  sort: { key: 'title' | 'dueAt' | 'priority'; dir: 'asc' | 'desc' };
  onSortChange: (s: ActionsTableProps['sort']) => void;
  selected: Set<string>; onSelectedChange: (ids: Set<string>) => void;
  onBulk: (op: 'done' | 'reassign' | 'delete', ids: string[]) => void;
  page: number; pageCount: number; onPageChange: (p: number) => void;
  filters?: { status?: ActionRow['status'][]; assignee?: string[] };
}
```

**États**
En-tête trié (asc/desc), ligne survolée (`--muted`, bouton menu visible), ligne sélectionnée (`--skrum-primary-soft`, case cochée), tout sélectionner mixte, ligne faite (titre barré muted), responsable invité, en retard, vide (`EmptyState`), chargement (`Skeleton`).

**Accessibilité & clavier**
- `<table>` natif ; en-têtes triables = `<button>` dans `<th aria-sort>`.
- Cases avec `aria-label` (« Sélectionner Isoler les données E2E ») ; `Shift+clic` sélectionne une plage.
- Le bandeau de sélection est `role="status"` ; les actions de lot restent atteignables au clavier.

**Temps réel**
Une action cochée par un autre membre passe en « Faite » avec un flash `--skrum-success-soft` ; l'ordre de tri n'est pas réappliqué sous les yeux (« 2 mises à jour — Actualiser »).

**À faire / À éviter**
- Faire : aligner à droite les nombres ; 20 lignes par page ; colonne de titre extensible.
- Éviter : plus de 7 colonnes ; zébrage + bordures en même temps ; clic sur la ligne qui entre en conflit avec la case.

**Tokens**
`--card` `--border` `--muted` `--muted-foreground` `--foreground` `--skrum-primary-soft` `--skrum-primary-text` `--skrum-warning-soft` `--skrum-warning-text` `--skrum-success-soft` `--skrum-success-text` `--skrum-destructive-soft` `--skrum-destructive-text` `--primary` `--ring` `--radius-xl` `--radius-md` `--font-mono`

**Mapping shadcn**
- `@/components/ui/table` (+ TanStack Table pour tri/sélection/pagination, pattern shadcn « Data Table »), `checkbox`, `badge`, `dropdown-menu`, `button`.
- Head : `h-9 px-3 text-xs font-semibold text-muted-foreground` ; Row : `border-b hover:bg-muted data-[state=selected]:bg-skrum-primary-soft` ; Cell : `px-3 py-2.5`.
- Tri : `<Button variant="ghost" size="sm" className="-ml-2 h-7 text-xs">` + `ArrowUp`/`ChevronsUpDown`. Bandeau de sélection : `rounded-md bg-skrum-primary-soft text-skrum-primary-text text-body-sm font-semibold`.
