# Pré-mortem : Skrüm (lancement supposé le 2026-10-18)

Hypothèse : Skrüm sort dans 14 jours, en SaaS et en auto-hébergé, et c'est un échec. Les équipes ouvrent une rétro, quelque chose casse devant tout le monde, elles ne reviennent pas ; les auto-hébergeurs perdent des données à la mise à jour. Pourquoi ?

Base : l'état du dépôt au 2026-10-04 : `main` 655340d3, la branche `hardening` en cours, les rapports dans `docs/superpowers/research/`.

## Tigres (risques réels)

| # | Risque | Preuve | Urgence |
|---|---|---|---|
| T1 | **Personne n'a utilisé l'app pour de vrai.** Tout a été vérifié par des agents : captures, tests, revues. Aucune personne n'a mené une rétro complète à plusieurs. | Rapports 18e/roadmap/walkthrough : « no human visual review » ; l'extension Chrome n'a jamais été connectée. | Bloquant |
| T2 | **Écarts aux maquettes encore ouverts.** La maquette fait foi, or des écarts sont ouverts sur 60 lignes de maquettes, plus 3 petits bugs visibles (nom de phase tronqué, réactions qui se chevauchent, collage d'un code 2FA). | walkthrough-report, section coverage. | Bloquant pour le parcours rétro et l'onboarding, fast-follow pour le reste |
| T3 | **Sécurité.** Majeur v3 : changement d'e-mail sans mot de passe, donc prise de compte possible (correctif en cours dans `hardening`). S'y ajoutent deux risques acceptés : les comptes SSO n'ont aucune confirmation dans la sécurité, et le SSO et le SMTP sont modifiables depuis l'admin. Plus 13 constats sécurité mineurs. | review v3, ledger roadmap. | Bloquant |
| T4 | **Le chantier de durcissement arrive trop tard et trop gros.** Environ 1 800 correctifs mineurs et 9 000 lignes supprimées, avec des fusions allégées et les suites complètes seulement à la fin. C'est le changement le plus risqué du projet, juste avant la sortie. | wf_a5fdf904-d7e, ledger hardening. | Bloquant : pas de sortie sans suites vertes après durcissement, plus T1 refait dessus |
| T5 | **Mise à jour des données de production jamais faite sur une vraie base remplie.** 126 migrations, l'import health → surveys (`surveys:verify-health-import`), l'upgrade sur MariaDB/MySQL/SQLite peuplés. Le volume `storage` n'est arrivé qu'hier : les installations existantes ont pu perdre leurs fichiers envoyés. | Ledger plan 19 (action propriétaire en attente), majeur v2 compose. | Bloquant pour l'auto-hébergé |
| T6 | **La CI n'a jamais tourné sur GitHub.** Rien n'a été poussé, aucune vérification obligatoire n'est configurée. Le premier push risque d'être rouge sans qu'on sache pourquoi. | Ledger DB, roadmap. | Bloquant |
| T7 | **Processus de production non vérifiés.** Reverb et le worker de file ne tournaient pas dans le conteneur de dev ; le temps réel dépend des deux. L'image a démarré sur les 4 bases, mais le temps réel n'a jamais été vérifié avec cette image. | Session du 2026-10-04 (démarrage manuel). | Bloquant |
| T8 | **Accessibilité.** 128 constats a11y, aucun test au lecteur d'écran, le clavier ne marchait pas sur les filtres (corrigé). | review v3. | Fast-follow, sauf ceux du parcours rétro (bloquants) |
| T9 | **Traductions.** 158 constats i18n ; le tutoiement en français a été converti par script ; aucune relecture native en es/de. | review v3, informal-register. | Fast-follow |
| T10 | **Navigateurs.** Tous les tests tournent sur Chromium ; Firefox et WebKit ne sont pas installés pour Playwright. Safari iOS n'est pas couvert, alors que les participants rejoignent souvent depuis un téléphone. | fix majors, notes sur le focus. | Fast-follow, avec un passage manuel sur Safari iPhone avant la sortie |
| T11 | **Licence AGPL-3.0.** Le passage du MIT à l'AGPL est une décision juridique, prise dans le plan 29 sans relecture. | ledger roadmap P29. | Bloquant juridique : à trancher |

## Tigres de papier

- **Portabilité des bases.** Plus de 7 500 tests sont verts sur pgsql, sqlite, mariadb et mysql, et la concurrence est verte sur les quatre. Le risque est faible, à condition de refaire la matrice après le durcissement.
- **Couverture de tests.** 1 272 tests navigateur, 7 940 tests PHP, 5 797 tests Vitest et 112 routes GET sur 115 couvertes. Le problème n'est pas la quantité (voir T1).
- **Timeouts des tests navigateur.** Ils n'apparaissent que sous charge, quand la suite PHP tourne en parallèle, et passent seuls.
- **Volume de code (581 000 lignes).** C'est impressionnant, mais tests compris, et l'audit ponytail en retire environ 9 000.

## Éléphants (non discutés)

| # | Doute | Comment vérifier |
|---|---|---|
| E1 | **Charge réelle.** Personne n'a mesuré une rétro à 30–50 participants : diffusion des événements, présence, curseurs, verrous. | Test de charge Reverb : 50 clients scriptés sur une rétro, mesure de la latence et des erreurs. |
| E2 | **Périmètre trop large pour l'équipe qui maintient.** Rétro, poker, whiteboard, 10 jeux, sondages, intégrations, MCP, admin. Chaque fonction est une surface de bugs. Le code a été écrit par des agents : qui le comprend vraiment ? | Lister les fonctions indispensables à la sortie et masquer le reste derrière un réglage. |
| E3 | **Sauvegarde et restauration jamais testées** sur les 4 bases plus `storage`. | Tester une restauration de bout en bout sur une instance de préproduction. |
| E4 | **RGPD.** Les IP sont affichées dans les sessions actives, le journal d'audit est conservé 365 jours, le résumé IA est envoyé à un fournisseur externe ; il n'y a ni export ni suppression des données sur demande, ni pages légales (backlog). | Revue RGPD et pages légales avant la sortie SaaS. |
| E5 | **Délivrabilité des e-mails** (liens magiques, codes, invitations) : SPF, DKIM, spam. Si l'e-mail n'arrive pas, la connexion échoue. | Test avec mail-tester, et vérifier qu'une connexion par mot de passe reste possible. |
| E6 | **Pas d'utilisateurs pilotes.** Aucun retour d'une vraie équipe sur le parcours. | 2 ou 3 équipes pilotes pendant une semaine avant la sortie publique. |

## Plans d'action, tigres bloquants

| Risque | Mitigation | Responsable | Échéance |
|---|---|---|---|
| T1 | Rétro réelle à 4 personnes (2 invités, 1 téléphone), poker et whiteboard sur l'instance de dev ; tous les problèmes notés. | Toi + 3 testeurs | 2026-10-09 |
| T2 | Trancher la liste des écarts aux maquettes ouverts ; corriger ceux de la rétro et de l'onboarding. | Toi (décision), agents (correctifs) | 2026-10-11 |
| T3 | Fusionner le correctif e-mail ; revoir les 13 constats sécurité ; reconfirmer ou annuler les deux risques acceptés. | Agents + toi | 2026-10-08 |
| T4 | Ne rien sortir avant : `hardening` vert sur les 4 bases + suite navigateur + T1 refait sur `hardening`. Geler les nouvelles fonctions. | Agents, puis toi | 2026-10-10 |
| T5 | Restaurer une copie de base de prod (ou un jeu peuplé) sur chaque moteur, `migrate`, `surveys:verify-health-import`, vérifier les nombres de lignes ; note de mise à jour sur le volume `storage`. | Agents (scripts), toi (exécution sur les vraies données) | 2026-10-12 |
| T6 | Pousser sur une branche, faire passer la CI GitHub, marquer les vérifications obligatoires. | Toi (push), agents (correctifs CI) | 2026-10-08 |
| T7 | Lancer l'image de production complète (web, Reverb, file, planificateur) avec docker compose sur une machine propre ; tester une rétro à 2 navigateurs en temps réel. | Agents + toi | 2026-10-10 |
| T11 | Valider ou revenir sur l'AGPL-3.0. | Toi (juridique) | 2026-10-09 |

À revoir le 2026-10-11, une semaine avant la sortie.
