Ligne d'action : engagement pris en rétro, avec statut, responsable, priorité, échéance et ticket Jira/Linear lié.

## Quand l'utiliser
- Phase Actions de la rétro, page « Actions » de l'équipe, récap e-mail, début de la rétro suivante (revue des actions).
- C'est le cœur de la promesse « les actions restent » : toujours traçable jusqu'à sa rétro d'origine.

## Anatomie
Pastille de statut cliquable (vide = à faire, demi-disque = en cours, coche = fait) · titre · méta : priorité (`sk-prio`, 3 barres + libellé), échéance (rouge + « En retard » si dépassée), rétro d'origine · droite : badge de statut, ticket (`sk-ticket` : outil + clé, lien externe), avatar du responsable.

## Props
```ts
type ActionStatus = "todo" | "doing" | "done";
type ActionPriority = "low" | "medium" | "high";

interface ActionItemProps {
  id: string;
  title: string;
  status: ActionStatus;
  priority: ActionPriority;
  dueDate?: string | null;          // ISO ; en retard si < aujourd'hui et status ≠ done
  doneAt?: string | null;
  owner?: { id: string; name: string; initials: string; presence: number } | null;
  source?: { retroId: string; label: string };   // « Rétro sprint 42 »
  ticket?: { provider: "jira" | "linear"; key: string; url: string } | null;
  editing?: boolean;
  onStatusChange?: (s: ActionStatus) => void;
  onChange?: (patch: Partial<Omit<ActionItemProps, "id">>) => void;
  onLinkTicket?: () => void;
}
```

## États
à faire · en cours · fait (titre barré, `--muted-foreground`) · priorité basse / moyenne / haute · échéance · en retard (bordure et date `--skrum-destructive-text`, badge) · sans responsable (avatar invité « + ») · sans ticket (« Lier un ticket ») · lien Jira `ATLAS-1287` / Linear `ENG-42` · édition inline (titre, responsable, priorité, échéance, ticket).

## Accessibilité & clavier
- Liste `role="list"` ; pastille de statut = bouton avec `aria-label` décrivant l'état et l'action suivante.
- <kbd>Espace</kbd> fait avancer le statut · <kbd>Entrée</kbd> édite · <kbd>⌘/Ctrl</kbd>+<kbd>Entrée</kbd> enregistre · <kbd>Échap</kbd> annule.
- Priorité et retard exprimés en texte (« Haute », « En retard »), pas seulement par la couleur.
- Lien ticket : `target="_blank"` + `rel="noopener"`, libellé « Ouvrir ATLAS-1287 dans Jira ».

## Temps réel
- `ActionCreated`, `ActionUpdated` sur `presence-retro.{sessionId}` pendant la rétro, puis `private-team.{teamId}.actions` hors session.
- Synchro intégrations : webhook Jira/Linear → job Laravel → `ActionUpdated {status}` (le statut du ticket fait foi s'il est lié).
- Verrou doux d'édition comme `RetroCard`.

## Mapping shadcn
`Badge` (statut), `Select` (responsable, priorité), `Popover` + `Calendar` (échéance), `Command` (recherche de ticket), `Input`, `Button size="sm"`. Ligne : `flex items-center gap-3 rounded-lg border bg-card px-3.5 py-3`.

## À faire / À éviter
- Faire : un verbe à l'infinitif, un seul responsable, une échéance.
- Éviter : actions sans responsable après la rétro (relance automatique) ; texte rouge pour autre chose que le retard.

## Tokens
`--card` `--border` `--input` `--foreground` `--muted` `--muted-foreground` `--ring` `--skrum-destructive-text` `--skrum-destructive-soft` `--skrum-warning-text` `--skrum-info-text` `--skrum-info-soft` `--skrum-success` `--skrum-success-foreground` `--skrum-success-soft` `--skrum-success-text` `--font-mono` `--radius` `--radius-xs` `--space-2` `--space-3`

## Container queries

`ActionItem` est son propre conteneur (`@container/action`). **≤ 480 px** (panneau latéral, colonne Actions du board, mobile) : le groupe de droite (`.sk-action-side` : statut, ticket, responsable) passe sous le corps, aligné sur le titre (retrait `--sk-action-indent` = largeur du bouton de statut + `space-3`), l'avatar en premier ; le bouton de statut reste en haut. Tailwind : `@container/action` sur la ligne, `@max-action-stack/action:basis-full @max-action-stack/action:pl-8` (`--container-action-stack` = 30rem, ajouté au thème) sur le groupe de droite. Un conteneur ne peut pas se restyler lui-même : les règles visent ses enfants.
