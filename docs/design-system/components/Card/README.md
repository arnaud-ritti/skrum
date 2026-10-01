Surface de regroupement de contenu : card simple (en-tête, contenu, pied), card de session récente cliquable, card de statistique.

**Quand l'utiliser**
- Simple : bloc de réglage ou d'information autonome (inviter l'équipe, intégration).
- Session récente : grille du dashboard, reprise d'une session en cours.
- Stat : un indicateur chiffré réel avec sa période et sa tendance.
- Pas pour une carte de rétro (→ `RetroCard`).

**Anatomie**
`--card`, bord `--border`, `--radius-xl`, `--shadow-card`. Simple : en-tête (titre 16/650 + description 13) → corps → pied avec actions (padding 20). Session : pastille de type 32 px dans la couleur de module (`sk-c-*`), titre, équipe · date, badge d'état, méta (participants, cartes, actions) ou pile de présence + « Rejoindre ». Stat : libellé 12/600, valeur `--font-display` 28/700, tendance (icône + texte coloré), sparkline `--chart-1`, contexte en une ligne.

**Props**
```ts
interface CardProps extends React.HTMLAttributes<HTMLDivElement> { title?: string; description?: string; footer?: React.ReactNode }
interface SessionCardProps { href: string; kind: 'retro' | 'poker' | 'whiteboard' | 'poll' | 'icebreaker'; title: string; team: string; when: string; status: 'live' | 'scheduled' | 'ended'; stats?: { participants: number; cards?: number; actions?: number }; people?: AvatarProps[] }
interface StatCardProps { label: string; value: string; trend?: { direction: 'up' | 'down'; label: string; good: boolean }; series?: number[]; context: string; icon?: LucideIcon }
```

**États**
Repos, survol (session : `--shadow-raised` + bord teinté `--primary`), focus clavier (anneau `--ring`), en direct (badge success + point), terminée (badge muted).

**Accessibilité & clavier**
- Card de session = un seul lien englobant (pas de boutons imbriqués) ; titre dans le nom accessible.
- Tendance : le sens est écrit (« +8 pts ») et pas seulement par la flèche ou la couleur ; sparkline `aria-hidden` avec le contexte en texte.

**Temps réel**
La card d'une session live met à jour sa pile de présence et son badge ; à la fin de la session, elle passe à « Terminée » avec les compteurs finaux.

**À faire / À éviter**
- Faire : une action principale par card ; chiffres toujours datés/périmétrés.
- Éviter : cards dans des cards ; bordure gauche colorée ; stats décoratives sans source.

**Tokens**
`--card` `--card-foreground` `--border` `--muted-foreground` `--primary` `--ring` `--skrum-primary-text` `--skrum-success-text` `--skrum-destructive-text` `--chart-1` `--skrum-col-*` `--shadow-card` `--shadow-raised` `--radius-xl` `--radius-md` `--space-4` `--space-5` `--font-display` `--duration-fast`

**Mapping shadcn**
- `@/components/ui/card` : `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` (+ `CardAction` pour le badge).
- Card : `rounded-xl border bg-card text-card-foreground shadow-card gap-0 py-0` ; header `px-5 pt-5 gap-1` ; content `p-5` ; footer `px-5 pb-5 gap-2`.
- Session : `<Link className="block p-4 transition-shadow hover:shadow-raised hover:border-primary/35 focus-visible:ring-2 focus-visible:ring-ring">`.
- Stat : valeur `font-display text-stat font-bold tracking-tight`, tendance `text-xs font-bold text-skrum-success-text`.

## Container queries (obligatoire)

Une carte s'adapte à la largeur de **son conteneur** (cellule de grille, sidebar, colonne, drawer), jamais au viewport. La même SessionCard peut vivre dans une grille de dashboard à 340 px et dans une sidebar à 200 px.

- `Card` déclare le conteneur : `@container/card` (preview : `.sk-card { container: card / inline-size }`).
- **SessionCard** (`.sk-session`), seuils :
  - **< 200 px** : l'icône de module est masquée, le badge passe sous le titre, les compteurs perdent leur unité (« 38 » au lieu de « 38 cartes »).
  - **200–299 px** : l'icône s'étend sur deux lignes, le titre fait 2 lignes max, le badge se place sous le titre.
  - **≥ 300 px** : le badge s'aligne à droite, sur une seule ligne.
- Dans tous les cas, le titre est limité à 2 lignes (`line-clamp-2`), le sous-titre tient sur une ligne avec ellipse, et les métadonnées passent à la ligne sans couper un compteur (`whitespace-nowrap` sur chaque item).
- **≤ 17.5rem (280 px)** (`@max-card-narrow/card:`), pour toutes les cards : le padding descend à `space-4` et les boutons du pied passent en pleine largeur.
- Une card ne déclare jamais de largeur fixe : c'est le parent qui décide.

```tsx
<Card className="@container/card gap-3 p-4">
  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 @card-wide/card:grid-cols-[auto_minmax(0,1fr)_auto] @card-wide/card:items-center">
    <ModuleIcon className="row-span-2 @card-wide/card:row-span-1 @max-card-compact/card:hidden" />
    <div className="min-w-0">
      <p className="line-clamp-2 font-semibold">{title}</p>
      <p className="truncate text-xs font-medium text-muted-foreground">{team} · {relative}</p>
    </div>
    <Badge className="col-start-2 justify-self-start @card-wide/card:col-start-3 @card-wide/card:row-start-1 @max-card-compact/card:col-start-1">{status}</Badge>
  </div>
  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground [&>span]:whitespace-nowrap">
    <span><Users /> {participants}</span>
    <span><StickyNote /> {cards}<span className="@max-card-compact/card:hidden"> cartes</span></span>
  </div>
</Card>
```

Les seuils sont des tailles de conteneur ajoutées au thème Tailwind (`app.css`) : `--container-card-compact` 12.5rem, `--container-card-narrow` 17.5rem, `--container-card-wide` 18.75rem. Classes : `@card-wide/card:` (min-width), `@max-card-compact/card:` (max-width). Pas de valeur arbitraire `@min-[…]`.
