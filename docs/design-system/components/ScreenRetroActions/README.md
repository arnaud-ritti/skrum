Rétrospective en phase Actions (desktop 1440×900) : transformer les sujets les plus votés en actions suivies.

**Zones**
- Topbar, PhaseStepper sur Actions (toutes les phases précédentes cochées).
- Colonne gauche (420 px) : sujets triés par votes (#rang, titre, total, extrait) ; le sujet discuté est en `is-focused` avec badge « En discussion » et nombre d'actions liées.
- Panneau droit (Card) : titre + compteur, « Exporter vers Jira », formulaire d'ajout rapide lié au sujet en focus (titre en focus, responsable, priorité, échéance, ticket Jira, Créer ; raccourcis ↵ et ⌘J), puis liste d'ActionItem (Checkbox, responsable, sk-prio, échéance — en retard en `is-late` —, sk-ticket, sujet d'origine). L'action juste créée est cerclée `--skrum-success`.
- FacilitatorBar (en bas à gauche) : Sujet suivant, Clôturer la rétro.
- Toast succès « Action créée » avec Annuler.

**Comportement** — les actions rejoignent le tableau de bord de l'équipe et sont rappelées à la rétro suivante (voir l'action « Rétro sprint 41 » en retard).

**Mobile** — sujets en liste repliable au-dessus ; formulaire en Drawer (champs empilés) ; toast en bas pleine largeur.
