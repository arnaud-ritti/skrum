Sélection de date (`Calendar`, `DatePicker`) et de plage de dates, avec raccourcis métier (« Fin du sprint ») et saisie clavier, localisée FR / EN.

**Quand l'utiliser**
- `DatePicker` : échéance d'une action, date d'une rétro planifiée, date d'expiration d'un lien invité.
- Plage (`DateRangePicker`) : filtres de listes (Action items, Estimation history, historique d'humeur) — préréglages « Ce sprint », « Sprint précédent », « 30 derniers jours ».
- `Calendar` seul : vue inline (planning des rituels, page d'admin) sans déclencheur.
- Date relative courte connue (« Demain », « Fin du sprint ») → raccourcis du popover, pas une saisie.

**Anatomie**
Déclencheur (36 px, comme `Select`) : icône `calendar` + date courte (FR « ven. 16 oct. », EN « Fri, Oct 16 ») ou placeholder muted. Popover (`--popover`, `--radius`, `--shadow-popover`, padding 12) → colonne de raccourcis 128 px (libellé + date en 12 px, actif `--skrum-primary-soft`) séparée par `--border` → Calendar : en-tête (mois, flèches ghost 32 px), ligne des jours 12/600 muted, grille 7 × 36 px. Plage : bande `--skrum-primary-soft` entre début et fin `--primary`, pied « 12 jours sélectionnés » + Effacer / Appliquer. Sous 428 px de large (requête de conteneur), les raccourcis passent en pastilles au-dessus du calendrier.

**Props**
```ts
type Locale = 'fr' | 'en';
interface DateShortcut { label: string; date: Date | null } // null = « Sans date »
interface CalendarProps {
  mode: 'single' | 'range';
  selected?: Date | { from?: Date; to?: Date };
  onSelect: (v: Date | { from?: Date; to?: Date } | undefined) => void;
  locale: Locale;
  weekStartsOn?: 0 | 1;            // FR : 1 (lundi, ISO 8601) ; EN : 0 (dimanche) par défaut, réglable dans Appearance
  disabled?: (d: Date) => boolean; // ex. week-ends, dates passées
  today?: Date;
}
interface DatePickerProps extends Omit<CalendarProps, 'mode' | 'selected' | 'onSelect'> {
  label: string;
  value?: Date;
  onValueChange: (d: Date | undefined) => void;
  shortcuts?: DateShortcut[];      // Aujourd'hui, Demain, Dans 1 semaine, Fin du sprint (sprint.endsAt)
  allowTyping?: boolean;           // champ texte jj/mm/aaaa | MM/DD/YYYY + langage naturel
  overdue?: boolean;               // value < today et action non faite
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}
interface DateRangeFilterProps { label: string; value?: { from: Date; to: Date }; presets: { label: string; range: { from: Date; to: Date } }[]; onApply: (r?: { from: Date; to: Date }) => void; locale: Locale }
```

**États**
Jour : défaut, survol (`--accent`), focus clavier (anneau `--ring` intérieur), aujourd'hui (gras `--skrum-primary-text` + point), sélectionné (`--primary`), hors mois (muted), désactivé (opacité .45 + barré), début / milieu / fin de plage. Déclencheur : vide, rempli, focus / ouvert, échéance dépassée (texte + icône `calendar-x` en `--skrum-destructive-text`, aide « En retard de 2 jours »), invalide (bordure `--destructive` + message), désactivé. Filtre : pastille active `--skrum-primary-soft` avec bouton de retrait.

**Accessibilité & clavier**
- Déclencheur `aria-haspopup="dialog"` + `aria-expanded` ; popover `role="dialog"` ; grille `role="grid"`, jours `role="gridcell"` avec `aria-label` complet (« vendredi 16 octobre »), `aria-selected`, `aria-current="date"`, `aria-disabled`.
- `← →` jour, `↑ ↓` semaine, `PgUp / PgDn` mois (`Maj` = année), `Début / Fin` début/fin de semaine, `Entrée` valide, `Échap` ferme et rend le focus.
- Titre du mois `aria-live="polite"`. Saisie : format affiché en placeholder et interprétation lue via `aria-describedby`.
- Le retard n'est jamais signalé par la couleur seule : icône + texte « En retard ».

**Temps réel**
Si le facilitateur modifie la fin du sprint, le raccourci « Fin du sprint » se met à jour sans fermer le popover ; une échéance modifiée par un autre membre met à jour le déclencheur avec un flash `--skrum-primary-soft`.

**À faire / À éviter**
- Faire : format court dans les listes (« 16 oct. » / « Oct 16 »), l'année seulement hors année courante ; formater avec `Intl.DateTimeFormat` / `date-fns` locale `fr` ou `enUS`.
- Faire : désactiver plutôt que masquer les dates impossibles.
- Éviter : saisie au format ambigu sans placeholder ; deux mois côte à côte dans un filtre mobile ; rouge pour une date simplement proche (→ `--skrum-warning-text`).

**Tokens**
`--popover` `--popover-foreground` `--border` `--input` `--card` `--accent` `--accent-foreground` `--primary` `--primary-foreground` `--skrum-primary-soft` `--skrum-primary-text` `--muted-foreground` `--ring` `--destructive` `--skrum-destructive-text` `--skrum-success-text` `--shadow-popover` `--radius` `--radius-md` `--duration-fast` `--ease-standard`

**Mapping shadcn**
- `@/components/ui/calendar` (react-day-picker v9) + `@/components/ui/popover` + `@/components/ui/button` ; locale `fr` / `enUS` de `date-fns`, `weekStartsOn`.
- Trigger : `Button variant="outline" className="h-9 w-full justify-start gap-2 px-3 text-sm font-normal data-[empty=true]:text-muted-foreground"` ; en retard : `text-skrum-destructive-text font-semibold [&_svg]:text-skrum-destructive-text`.
- PopoverContent : `w-auto p-3 flex gap-3 rounded-lg shadow-popover @container` ; raccourcis : `w-32 border-r pr-3 flex flex-col gap-0.5`, item `rounded-sm px-2 py-1 text-sm data-[active=true]:bg-skrum-primary-soft data-[active=true]:text-skrum-primary-text`.
- Calendar classNames : `day: 'size-9 rounded-md text-sm tabular-nums hover:bg-accent'`, `today: 'font-bold text-skrum-primary-text'`, `selected: 'bg-primary text-primary-foreground'`, `outside: 'text-muted-foreground'`, `disabled: 'opacity-45 line-through'`, `range_middle: 'rounded-none bg-skrum-primary-soft text-skrum-primary-text'`, `range_start: 'rounded-l-md'`, `range_end: 'rounded-r-md'`, `weekday: 'text-xs font-semibold text-muted-foreground'`.
- Pastille de filtre : `h-8 rounded-md border border-primary/45 bg-skrum-primary-soft text-skrum-primary-text text-body-sm font-semibold`.
