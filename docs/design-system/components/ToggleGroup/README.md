Boutons bascule : `Toggle` (un état on/off) et `ToggleGroup` (choix simple ou multiple parmi des options), dont la variante segmentée.

**Quand l'utiliser**
- `Toggle` : option d'affichage immédiate et réversible (« Masquer les tâches », « Spectateur » au poker, afficher les noms).
- `ToggleGroup` multiple : mise en forme d'une carte (gras, italique, barré, liste, lien), filtres cumulables (« Mes actions », « En retard », « Avec ticket »).
- `ToggleGroup` simple, icônes seules : mode de vue (grille / colonnes / liste).
- Segmenté (simple) : période d'un classement (« 30 derniers jours / Depuis toujours »), thème Clair / Sombre / Système.
- Panneaux de contenu différents → `Tabs` ; réglage persistant d'un formulaire avec enregistrement → `Switch` / `RadioGroup`.

**Anatomie**
Toggle 36 px, `--radius-md`, 14/600, icône 16 `--muted-foreground` ; variantes `ghost` (défaut, transparent) et `outline` (`--card`, bord `--input`, `--shadow-card`) ; icône seule 36 × 36. Activé : `--skrum-primary-soft` + `--skrum-primary-text` (outline : bord `--primary`). Groupe barre d'outils : conteneur `--card` bordé, items 32 px `--radius-sm`, séparateur 1 px. Segmenté : conteneur `--muted` padding 3, items 30 px 13/600 muted, actif `--card` + `--shadow-card` + `--foreground` (même langage que `Tabs` pilule).

**Props**
```ts
interface ToggleProps { pressed?: boolean; defaultPressed?: boolean; onPressedChange?: (p: boolean) => void; variant?: 'ghost' | 'outline'; size?: 'sm' | 'default'; icon?: LucideIcon; children?: React.ReactNode; 'aria-label'?: string; disabled?: boolean }
interface ToggleOption<T extends string> { value: T; label: string; icon?: LucideIcon; disabled?: boolean }
type ToggleGroupProps<T extends string> = {
  options: ToggleOption<T>[];
  variant?: 'ghost' | 'outline' | 'toolbar' | 'segmented';
  iconOnly?: boolean;                 // le label devient aria-label + tooltip
  'aria-label': string;
  disabled?: boolean;
} & ({ type: 'single'; value: T; onValueChange: (v: T) => void } | { type: 'multiple'; value: T[]; onValueChange: (v: T[]) => void });
```

**États**
Repos, survol (`--muted` ; outline `--accent` ; segmenté texte `--foreground`), activé, activé + focus (anneau `--ring`), désactivé (opacité .5, y compris activé), groupe désactivé avec raison (« Verrouillé pendant la phase Vote. », icône `lock`).

**Accessibilité & clavier**
- Toggle : `<button aria-pressed>`. Groupe simple : `role="radiogroup"` + items `role="radio"` `aria-checked` ; multiple : `role="group"` + `aria-pressed`. Toujours un `aria-label` de groupe.
- Icônes seules : `aria-label` obligatoire + `Tooltip` au survol et au focus.
- Un seul arrêt de tabulation par groupe, `← →` entre les items (roving tabindex), `Espace` / `Entrée` bascule.
- L'état activé ne repose pas sur la couleur seule : fond + texte + `aria-pressed`.

**Temps réel**
« Masquer les tâches » et « Spectateur » sont locaux au participant ; le verrouillage d'un groupe (anonymat pendant le vote) arrive en direct depuis le facilitateur et désactive le groupe sans changer sa valeur.

**À faire / À éviter**
- Faire : 2 à 5 options ; libellés courts (FR ~30 % plus longs — vérifier la largeur) ; segmenté pleine largeur sur mobile.
- Éviter : un Toggle dont le libellé change selon l'état (« Afficher » ↔ « Masquer ») ; mélanger icônes seules et libellés dans un même groupe ; groupe simple sans valeur par défaut.

**Tokens**
`--foreground` `--muted` `--muted-foreground` `--card` `--input` `--border` `--accent` `--primary` `--skrum-primary-soft` `--skrum-primary-text` `--ring` `--shadow-card` `--radius` `--radius-md` `--radius-sm` `--duration-fast` `--ease-standard`

**Mapping shadcn**
- `@/components/ui/toggle` (`toggleVariants`) et `@/components/ui/toggle-group` (`ToggleGroup`, `ToggleGroupItem`).
- toggleVariants base : `inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold whitespace-nowrap hover:bg-muted data-[state=on]:bg-skrum-primary-soft data-[state=on]:text-skrum-primary-text focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground data-[state=on]:[&_svg]:text-current`.
- `outline` : `border border-input bg-card shadow-card hover:bg-accent data-[state=on]:border-primary` ; icône seule : `size-9 px-0`.
- Barre d'outils : ToggleGroup `gap-0.5 rounded-lg border bg-card p-0.5 shadow-card`, items `size-8 rounded-sm` + `Separator orientation="vertical" className="mx-1 h-5"`.
- Segmenté : ToggleGroup `rounded-lg bg-muted p-0.75 gap-0.5`, item `h-7.5 rounded-md px-3 text-body-sm font-semibold text-muted-foreground hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-card` ; pleine largeur : `w-full [&>*]:flex-auto`.
