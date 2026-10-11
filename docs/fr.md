# ETS Edmonton

Les **prochains passages** d'ETS (autobus en temps réel, horaires du SLR) et
l'**état des lignes du SLR** près de chez vous, dans Gladys.

Cette intégration n'est pas affiliée à Edmonton Transit Service ni à la Ville
d'Edmonton.

## Démarrer en 3 étapes

Aucune connaissance technique n'est nécessaire, et aucun compte : il n'y a
**rien à créer, aucune clé**.

1. **Vérifiez l'adresse de votre maison dans Gladys** : _Paramètres →
   Maisons_. La maison doit avoir une position sur la carte. L'intégration s'en
   sert pour trouver les arrêts proches de chez vous. La position reste dans
   votre Gladys.
2. **Installez l'intégration** depuis le catalogue des intégrations, et
   acceptez l'accès à la position de la maison. Ouvrez sa page de
   configuration et cliquez sur **Enregistrer**, sans rien remplir.
3. Ouvrez l'onglet **Découverte** de l'intégration. Les 3 arrêts les plus
   proches de chez vous y sont proposés, avec leur nom et la direction des
   lignes, par exemple « ETS – 100 Street & 102 Avenue (411 → Downtown |
   Macewan, 523 → Downtown) », ainsi que l'appareil **ETS – SLR**. Cliquez sur
   **Ajouter** pour chacun de ceux qui vous intéressent.

C'est tout. Vous avez maintenant les **prochains passages** de chaque arrêt
et l'état des lignes du SLR.

Le message en haut de la page de configuration indique toujours la prochaine
chose à faire. Par exemple : « Prêt : 3 arrêts et les lignes à ajouter.
Ouvrez l'onglet Découverte… ».

Les noms des appareils commencent par **ETS –**, pour les retrouver d'un coup
d'œil dans la liste des appareils de Gladys. Vous pouvez les renommer
librement dans Gladys.

### Afficher les passages sur le tableau de bord

1. Ouvrez le tableau de bord, puis cliquez sur **Modifier**.
2. Ajoutez un widget et choisissez **Passages ETS**.
3. Choisissez l'arrêt, puis enregistrez.

Le widget **État des lignes ETS** s'ajoute de la même façon.

Les passages suivis en temps réel sont en vert. Les horaires prévus portent un
**~** et sont en gris : « ~12 min » signifie « prévu dans 12 minutes ».

## D'où viennent les passages

- **Autobus** : les prédictions en temps réel d'ETS, lues chaque minute pour
  tous vos arrêts d'un coup.
- **SLR** (lignes Capital, Metro et Valley) : ETS ne publie aucune prédiction
  pour elles. Leurs quais affichent les **horaires prévus**, via Transitous,
  un service communautaire gratuit, lus toutes les 2 minutes. Un quai du SLR
  est un arrêt à part entière, un par sens (« Churchill Station » en a deux).

## Suivre d'autres arrêts (travail, école…)

Pour un arrêt loin de chez vous :

1. En bas de la page de configuration, cliquez sur **Chercher un arrêt**.
   Tapez une rue, une station ou le numéro de l'arrêt, par exemple
   « Churchill » ou « 100 Street 102 Avenue ».
2. La réponse liste les arrêts avec leur numéro et la direction de leurs
   lignes, par exemple `1321 — 100 Street & 102 Avenue (411 → Downtown |
Macewan, 523 → Downtown)`.
3. Copiez le numéro (`1321`) dans **Arrêts**, enregistrez, puis ajoutez
   l'arrêt dans l'onglet **Découverte**.

Le numéro est celui écrit sur chaque panneau d'arrêt d'ETS.

### Pour aller plus loin

Le champ **Arrêts** accepte plusieurs numéros séparés par des virgules, un
filtre de ligne après `@` et un nom après `:`.

| Saisie                    | Signification                                |
| ------------------------- | -------------------------------------------- |
| `1321`                    | toutes les lignes qui passent à l'arrêt 1321 |
| `1321@523`                | la ligne 523 seulement                       |
| `1321@523\|411`           | les lignes 523 et 411                        |
| `1321@523:Bus du travail` | la ligne 523, affichée « Bus du travail »    |
| `18761@Capital`           | la ligne Capital à Churchill, dans un sens   |

## Ce que contient chaque appareil

**Arrêt :**

- **Prochain passage**, **Passage 2**… : les minutes d'attente. 999 signifie
  qu'aucun passage n'est prévu.
- **Ligne du prochain passage**… : la ligne (« 9 », « 523 », « Capital » pour
  le SLR).
- **Prochains passages** : un résumé, par exemple `523 3 min · 411 11 min`.

**SLR :** pour chaque ligne (Capital, Metro, Valley), un **état** (`Normal`,
`Perturbé`, `Avis` ou `Inconnu`) et le **message** de l'alerte d'ETS. Une
interruption, un service réduit ou de gros retards sont une perturbation ; un
détour ou toute autre annonce est un avis. Les ascenseurs, les escaliers
mécaniques et les alertes sur une seule station ne changent pas l'état d'une
ligne.

## Scènes

**Déclencheurs :**

- **Passage imminent** : un passage passe sous 1, 2, 3, 5, 10 ou 15 minutes.
  Exemple : « quand le 523 est à 5 minutes, allumer la lumière de l'entrée ».
- **État d'une ligne modifié** : une ligne est perturbée, revient à la
  normale, ou reçoit un avis. Exemple : « si la ligne Capital est perturbée,
  m'envoyer un message ».

**Actions :**

- **Lire les prochains passages** : par exemple un message chaque matin
  « Votre 523 passe dans {{minutes}} minutes ».
- **Lire l'état d'une ligne** : renvoie l'état, le message d'ETS et `normal`
  (vrai ou faux).

## En cas de problème

| Message ou symptôme                                    | Que faire                                                                                             |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| « renseignez l'adresse de votre maison »               | _Paramètres → Maisons_ : placez la maison sur la carte, puis enregistrez de nouveau la configuration. |
| « Gladys n'a pas partagé la position de votre maison » | Réinstallez l'intégration et acceptez l'accès à la position, ou tapez des numéros d'arrêts.           |
| Rien dans l'onglet Découverte                          | Lisez le message de la page de configuration : il dit ce qui manque.                                  |
| « L'arrêt … n'est pas dans la liste des arrêts ETS »   | Vérifiez le numéro sur le panneau. Un arrêt tout neuf arrive avec la prochaine version.               |
| Un arrêt reste à 999                                   | Aucun passage prévu (la nuit), ou un filtre de ligne qui ne correspond à aucune ligne de l'arrêt.     |
| Un quai du SLR affiche des temps « ~ »                 | Normal : ETS ne publie pas de temps réel pour le SLR, les horaires prévus sont affichés.              |

## Vie privée, données et licences

- La position de la maison sert seulement à chercher les arrêts proches, dans
  la liste d'arrêts livrée avec l'intégration : elle n'est envoyée nulle part.
- Liste des arrêts, temps réel et alertes : données d'ETS, données ouvertes de
  la Ville d'Edmonton, sous les
  [City of Edmonton Open Data Terms of Use](https://data.edmonton.ca/stories/s/City-of-Edmonton-Open-Data-Terms-of-Use/msh8-if28)
  (la liste des arrêts est mise à jour à chaque version).
- Horaires du SLR et directions : [Transitous](https://transitous.org/sources/),
  un service communautaire gratuit, à partir des données d'ETS.
- Code de l'intégration : licence Apache 2.0.
