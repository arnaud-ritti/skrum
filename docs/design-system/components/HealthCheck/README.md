Health check d'équipe : énoncés notés de 1 à 5 de façon anonyme, gérés par équipe, agrégés par rétro avec moyenne, distribution, tendance et alerte.

## Quand l'utiliser
- **Gestion des énoncés** : page équipe, section « Health check statements » (facilitateur / admin d'équipe).
- **Vue réponse** : participant, au début ou à la fin d'une rétro où le health check est activé (desktop et mobile).
- **Résultats agrégés** : phase Discussion ou ROTI de la rétro, et historique de l'équipe.
- Pas pour un sondage libre (→ `SurveyQuestion`) ni pour le ROTI de la réunion (→ `ROTIWidget`).

## Anatomie
- **Gestion** : `sk-card` · titre + note `info` « Changes apply to retros that have not collected answers yet. » · liste ordonnée de lignes (poignée `grip-vertical` 2.75rem de haut · libellé court en gras · badge `Built-in`/`Intégré` (`sk-badge--outline`) ou `Custom`/`Personnalisé` (`sk-badge--soft`) · énoncé complet `--muted-foreground` · `sk-switch` activé/désactivé · menu `…` pour les énoncés personnalisés seulement) · ligne soulevée pendant le réordonnancement (`--shadow-drag`, anneau `--ring`) · ligne désactivée (textes en `--muted-foreground` + badge `Disabled`) · formulaire d'ajout (libellé court + énoncé + « Add »).
- **Réponse** : en-tête avec badge `sk-anon` « Anonymous » · rappel des extrémités (1 · Strongly disagree / 5 · Strongly agree) · un `fieldset` par énoncé avec échelle 1–5 (`radiogroup`, cibles 2.75rem) · énoncé sans réponse : options en pointillés · pied : progression « 4 of 6 answered » + bouton « Submit answers » désactivé tant que tout n'est pas rempli.
- **Résultats** : pour chaque énoncé, libellé · moyenne `--font-display` « 4.0 /5 » · tendance vs rétro précédente (flèche + valeur signée, `--skrum-success-text` / `--skrum-destructive-text`, « no change » neutre) · barre de moyenne `--chart-1` avec repère du seuil 3/5 · distribution empilée 1→5 (`--skrum-roti-1…5`, comptes en `--skrum-roti-foreground`) · énoncé en alerte (moyenne < 3) : fond `--skrum-destructive-soft`, moyenne et barre `--destructive`/`--skrum-destructive-text`, badge `triangle-alert` « Needs attention ».

## Énoncés intégrés (6)
| Libellé EN | Énoncé EN | Libellé FR | Énoncé FR |
| --- | --- | --- | --- |
| Interaction | Interaction with colleagues was productive | Interaction | Les échanges avec mes collègues ont été productifs |
| Clear tasks | Tasks assigned to me were clear | Tâches claires | Les tâches qui m'étaient confiées étaient claires |
| Manager support | My manager was understanding and supportive | Soutien manager | Mon manager s'est montré compréhensif et soutenant |
| Vision | The vision and goals are clear to me | Vision | La vision et les objectifs sont clairs pour moi |
| Processes | Our processes let me work without blockers | Processus | Nos processus me permettent de travailler sans blocage |
| Motivation | I felt motivated in my work | Motivation | Mon travail m'a motivé |

Les intégrés ne se suppriment pas (désactivation seulement) et ne s'éditent pas ; les personnalisés s'éditent, se suppriment, se réordonnent comme les autres.

## Props
```ts
interface HealthStatement {
  id: string;
  label: string;            // libellé court (≤ 24 car.)
  text: string;             // énoncé complet (≤ 120 car.)
  builtIn: boolean;
  enabled: boolean;
  position: number;
}

interface HealthStatementsManagerProps {
  statements: HealthStatement[];
  canManage: boolean;
  onToggle: (id: string, enabled: boolean) => void;
  onReorder: (orderedIds: string[]) => void;
  onAdd: (s: { label: string; text: string }) => void;
  onEdit?: (id: string, s: { label: string; text: string }) => void;   // custom uniquement
  onDelete?: (id: string) => void;                                     // custom uniquement
}

interface HealthCheckFormProps {
  retroTitle: string;                         // « Sprint 42 »
  statements: Pick<HealthStatement, "id" | "label" | "text">[];
  answers: Record<string, 1 | 2 | 3 | 4 | 5 | undefined>;
  onAnswer: (statementId: string, value: 1 | 2 | 3 | 4 | 5) => void;
  onSubmit: () => void;
  submitted?: boolean;
}

interface HealthCheckResultsProps {
  retroTitle: string;
  respondents: number;
  participants: number;
  previousRetroTitle?: string;                // « sprint 41 »
  results: {
    statementId: string;
    label: string;
    distribution: [number, number, number, number, number]; // nb de réponses 1→5
    mean: number;                             // 1–5
    previousMean?: number | null;
  }[];
  alertThreshold?: number;                    // défaut 3
}
```

## États
Gestion : repos · ligne soulevée (réordonnancement, annonce « Moving · position 3 of 7 ») · énoncé désactivé · énoncé personnalisé (menu) · formulaire d'ajout (ligne sur 3 colonnes ≥ 30rem de card, empilé sinon). Réponse : répondu (`is-on` primaire) · à répondre (pointillés) · progression · envoyer désactivé/actif · envoyé (lecture seule). Résultats : normal · tendance hausse / baisse / stable · alerte < 3 · pas de rétro précédente (tendance masquée) · moins de 3 répondants (résultats masqués pour préserver l'anonymat : « Not enough answers to show results »).

## Accessibilité & clavier
- Réordonnancement dnd-kit au clavier : <kbd>Espace</kbd> saisir la poignée, <kbd>↑</kbd>/<kbd>↓</kbd> déplacer, <kbd>Espace</kbd> déposer, <kbd>Échap</kbd> annuler ; annonces `aria-live="polite"`.
- Switch : `role="switch"` + `aria-checked`, nommé par le libellé de l'énoncé.
- Échelle : `fieldset` + `legend` (libellé + énoncé), `role="radiogroup"` ; flèches pour changer de valeur, <kbd>1</kbd>–<kbd>5</kbd> sur l'énoncé focalisé ; les extrémités de l'échelle sont annoncées via `aria-describedby`.
- Résultats : la distribution a un `role="img"` avec `aria-label` (« 1 : 2 · 2 : 3 … ») ; la tendance est écrite (« −0.6 vs sprint 41 »), jamais seulement colorée ; l'alerte a icône + texte.
- Anonymat : aucun nom ni avatar dans les résultats ; seuil minimal de 3 répondants.

## Temps réel
- Réponses envoyées par requête Inertia (`POST /retros/{id}/health-check`), jamais en whisper ; le serveur ne diffuse que des agrégats.
- Événement `HealthCheckProgress { answered, participants }` sur `presence-retro.{id}` pour le facilitateur ; `HealthCheckResultsRevealed` quand il affiche les résultats.
- Les changements d'énoncés ne s'appliquent qu'aux rétros sans réponse : une rétro gèle sa liste à la première réponse (`statements_snapshot`).

## À faire / À éviter
- Faire : formuler les énoncés à la 1ʳᵉ personne, positifs, mesurables sur 1–5.
- Faire : afficher la tendance avec la rétro précédente de la même équipe uniquement.
- Éviter : plus de 8 énoncés actifs ; supprimer un intégré ; montrer qui a répondu quoi.
- Éviter : bordure gauche colorée pour l'alerte ; dégradés dans les barres.

## Tokens
`--card` `--border` `--foreground` `--muted` `--muted-foreground` `--primary` `--primary-foreground` `--ring` `--input` `--accent` `--chart-1` `--destructive` `--skrum-destructive-soft` `--skrum-destructive-text` `--skrum-success-text` `--skrum-primary-soft` `--skrum-primary-text` `--skrum-roti-1` … `--skrum-roti-5` `--skrum-roti-foreground` `--shadow-drag` `--shadow-raised` `--radius` `--radius-md` `--radius-sm` `--radius-xs` `--space-1` `--space-1-5` `--space-2` `--space-3` `--space-4` `--font-display`

## Mapping shadcn
- Card : `@/components/ui/card` (`@container/card`) ; formulaire d'ajout `grid gap-2 @card-wide/card:grid-cols-[auto_minmax(0,1fr)_auto]`, champ libellé `@card-wide/card:w-36`.
- Switch `@/components/ui/switch` ; Badge `@/components/ui/badge` (`variant="outline"` Built-in, classes `bg-skrum-primary-soft text-skrum-primary-text` Custom) ; Input `@/components/ui/input` ; Button `variant="secondary"`.
- Échelle : `@/components/ui/toggle-group type="single"` → items `h-11 rounded-md border border-input font-bold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground`.
- Progression `@/components/ui/progress`. Résultats : `flex h-5 gap-0.5` + segments `bg-skrum-roti-1 … text-skrum-roti-foreground rounded-xs text-overline` ; barre de moyenne `h-2 rounded-full bg-muted` / `bg-chart-1` ; alerte `rounded-lg bg-skrum-destructive-soft`.
