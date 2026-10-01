Popover « Réglages de la session » ouvert depuis la FacilitatorBar : anonymat, votes, timer par phase, présence, verrouillage et ajout d'un sondage, appliqués en une fois — Sheet sur écran large, Drawer sur mobile.

## Quand l'utiliser
- En cours de rétro, depuis l'icône `settings` de la `FacilitatorBar` (ou de la topbar de session, comme dans l'app réelle à côté du timer).
- Réglages **en direct** d'une session existante. La configuration initiale se fait dans `ScreenSessionCreate` ; les réglages d'équipe (énoncés de health check) dans `ScreenTeam`.
- Écran large (≥ 1280 px) ou quand le facilitateur veut garder les réglages ouverts → `Sheet` latérale non modale (le board reste utilisable). Mobile → `Drawer`.
- Participant : même déclencheur, contenu en lecture seule (cadenas) pour savoir à quoi s'en tenir (anonymat, budget de votes).

## Anatomie
En-tête (icône `settings-2` `--skrum-primary-text` ou `lock` en lecture seule, titre, « Rétro sprint 42 · Écriture », fermer) · groupes séparés par `--border`, titre en overline :
- **Cartes** : Cartes anonymes (`Switch`), Verrouiller le board (`Switch`).
- **Vote** : Votes par personne (stepper − n +, 1–10), Max par carte (stepper, 1 – votes par personne), Masquer les votes jusqu'à la révélation (`Switch`).
- **Timer** : Timer par phase (`Select` : off, 3, 5, 7, 10, 15 min) + aide listant les phases concernées.
- **Présence** : Curseurs visibles, Réactions activées (`Switch`).
- « Ajouter un sondage » (outline pleine largeur, `clipboard-list` + `chevron-down`) → menu : Health check (badge « Intégré », 6 énoncés), Sondage rapide, Depuis un modèle… ; note « Affiché après les Actions, avant le ROTI ».
- Avertissement `sk-alert--warning` quand un réglage modifié ne s'applique qu'à la phase suivante.
- Pied `--muted` : statut (« Aucune modification » / « 2 modifications non appliquées ») · « Réinitialiser » (ghost) · « Appliquer (n) ».

Ligne : libellé 13/600 + aide 12 `--muted-foreground` à gauche, contrôle à droite ; ligne modifiée = point `--primary` avant le libellé, mention « Modifié » `--skrum-primary-text`, bordure du contrôle `--primary`.

## Props
```ts
type RetroPhase = 'icebreaker' | 'writing' | 'grouping' | 'voting' | 'discussing' | 'actions' | 'roti';

interface SessionSettings {
  anonymousCards: boolean;
  boardLocked: boolean;
  votesPerPerson: number;          // 1..10
  maxVotesPerCard: number;         // 1..votesPerPerson
  hideVotesUntilReveal: boolean;
  phaseTimerMinutes: number | null;
  showCursors: boolean;
  reactionsEnabled: boolean;
}

interface SessionSettingsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionTitle: string;
  phase: RetroPhase;
  value: SessionSettings;                         // valeurs appliquées (serveur)
  draft?: Partial<SessionSettings>;               // modifications locales non appliquées
  onDraftChange: (draft: Partial<SessionSettings>) => void;
  /** clés dont l'effet est différé à la phase suivante, calculé côté serveur pour la phase courante */
  deferred?: { key: keyof SessionSettings; fromPhase: RetroPhase }[];
  readOnly?: boolean;                             // participant
  facilitatorName?: string;                       // message de lecture seule
  surveys?: { healthCheckStatements: number; templates: { id: string; title: string }[] };
  onAddSurvey: (kind: 'health_check' | 'quick_poll' | { templateId: string }) => void;
  onApply: (patch: Partial<SessionSettings>) => Promise<void>;   // puis toast « Réglages appliqués » + Annuler
  onReset: () => void;
  variant?: 'popover' | 'sheet' | 'drawer';       // défaut : popover ; drawer si useIsMobile()
}
```

## États
- **Défaut** (facilitateur) : rien de modifié, « Réinitialiser » et « Appliquer » désactivés.
- **Modifié non appliqué** : lignes marquées, compteur dans le pied et le bouton (« Appliquer 2 modifications »), fermeture → confirmation légère « Abandonner 2 modifications ? ».
- **Effet différé** : avertissement « Le timer par phase s'applique à partir de la phase suivante (Regroupement). Le timer en cours continue. » — idem pour Votes par personne / Max par carte pendant le Vote (votes déjà posés conservés) et Cartes anonymes après l'Écriture.
- **Appliqué** : toast Sonner succès « Réglages appliqués » + « Annuler » (5 s) ; le popover reste ouvert, pied revenu à « Aucune modification ».
- **Menu « Ajouter un sondage »** ouvert ; si un sondage est déjà ajouté, le bouton devient « Health check ajouté · Modifier ».
- **Lecture seule** (participant) : cadenas dans l'en-tête, bandeau « Seule la facilitatrice, Camille R., peut modifier ces réglages. », valeurs en texte (Activé / 5 / 5 min), pas de pied ni de sondage.
- **Sheet** large non modale ; **Drawer** mobile (montré ici en lecture seule participant).
- Envoi en cours : bouton « Appliquer » avec `sk-trema`, contrôles désactivés.

## Accessibilité & clavier
- Déclencheur : `aria-haspopup="dialog"`, `aria-expanded`, état actif ; raccourci `,` (virgule) pour ouvrir quand le board a le focus.
- Contenu `role="dialog"` + `aria-labelledby` ; `Esc` ferme (confirmation s'il reste des modifications), focus rendu à l'icône.
- Groupes `role="group"` + `aria-label` ; `Switch` `role="switch"` + `aria-checked` ; stepper = `role="group"` avec boutons « − » / « + » libellés et `<output aria-live="polite">` (flèches ↑/↓ quand la valeur a le focus, bornes désactivées).
- L'avertissement de phase est en `role="status"` ; « Modifié » est lu avec le libellé.
- Lecture seule : contrôles remplacés par du texte (pas de contrôles désactivés non focusables qui cachent la valeur).
- `⌘↵` / `Ctrl ↵` applique.

## Temps réel
- `SessionSettingsUpdated {patch, appliesFrom?: RetroPhase}` sur `presence-retro.{sessionId}` ; les participants voient un toast info court (« Les votes sont maintenant masqués jusqu'à la révélation »).
- Les réglages différés sont stockés côté serveur avec `appliesFrom` et basculés au `PhaseChanged`.
- Si un co-facilitateur applique pendant qu'un brouillon est ouvert : valeurs serveur mises à jour, brouillon conservé sur les seules clés modifiées, conflit signalé par l'aide « Modifié aussi par Théo ».
- `SurveyAttached {kind}` ajoute l'étape sondage au `PhaseStepper` de tous.

## À faire / À éviter
- Faire : appliquer en un clic groupé (un seul broadcast, pas de tremblement du board à chaque switch) ; dire QUAND un réglage prend effet.
- Faire : garder Max par carte ≤ Votes par personne (stepper borné, pas d'erreur après coup).
- Éviter : cacher le popover aux participants ; mettre ici des actions de phase (révéler, phase suivante) qui appartiennent à la `FacilitatorBar` ; des switches désactivés grisés comme unique indication de lecture seule.

## Tokens
`--popover` `--popover-foreground` `--card` `--muted` `--muted-foreground` `--foreground` `--border` `--input` `--accent` `--primary` `--primary-foreground` `--ring` `--skrum-primary-soft` `--skrum-primary-text` `--skrum-warning-soft` `--skrum-warning-text` `--skrum-success-text` `--secondary` `--secondary-foreground` `--skrum-scrim` `--radius` `--radius-md` `--radius-xl` `--radius-2xl` `--shadow-popover` `--shadow-modal` `--shadow-raised` `--space-1` `--space-1-5` `--space-2` `--space-3` `--space-4` `--space-5` `--z-overlay`

## Mapping shadcn
- `@/components/ui/popover` (défaut, `align="end"` sous l'icône de la FacilitatorBar) / `@/components/ui/sheet` (`side="right"`, `modal={false}`) / `@/components/ui/drawer` ; `switch`, `select`, `button`, `dropdown-menu` (sondage), `alert`, `badge`, `separator`, `sonner`.
- PopoverContent : `w-92 p-0 overflow-hidden rounded-lg shadow-popover flex flex-col`. SheetContent : `w-100 p-0 gap-0 sm:max-w-100`.
- En-tête : `flex items-start gap-2 pl-4 pr-3 pt-3 pb-2` ; titre `text-ui-lg font-semibold truncate`, sous-titre `text-xs text-muted-foreground`.
- Groupe : `flex flex-col border-t px-4 py-2` ; titre `text-overline uppercase text-muted-foreground py-1`.
- Ligne : `flex flex-wrap items-center justify-between gap-x-3 gap-y-1 min-h-10 py-1` ; libellé `min-w-0 flex-1 basis-36 text-body-sm font-semibold` ; modifié : `before:size-1.5 before:rounded-full before:bg-primary` + `text-overline text-skrum-primary-text`.
- Stepper : `inline-flex h-8 items-center rounded-md border border-input bg-card` ; boutons `Button variant="ghost" size="icon" className="size-8 rounded-none"` ; valeur `min-w-8 border-x text-center text-sm font-bold tabular-nums` ; modifié `border-primary`.
- `SelectTrigger className="h-8 w-30"`.
- Avertissement : `Alert className="mx-4 mb-3 gap-2 px-3 py-2 text-body-sm bg-skrum-warning-soft text-skrum-warning-text"`.
- Sondage : `Button variant="outline" size="sm" className="w-full"` + `DropdownMenuContent className="w-80"` ; item `items-start py-1.5` + description `text-xs text-muted-foreground truncate`.
- Pied : `flex flex-wrap items-center justify-between gap-2 border-t bg-muted pl-4 pr-3 py-2` ; statut `text-xs text-muted-foreground`.
- Lecture seule : bandeau `Alert className="mx-4 mb-3 bg-muted text-muted-foreground text-body-sm"` + icône `Lock` ; valeur `text-body-sm font-semibold text-muted-foreground`.
