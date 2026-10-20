# Timestral dans Slay the Fish

*English: [timestral.md](timestral.md)*

Comment on utilise Timestral, le modèle de prévision de séries temporelles de Mistral, sur les parties simulées par le bot : ce que c'est, comment le lancer, ce qu'il renvoie et comment lire les résultats.

## 1. Ce qu'est Timestral

Timestral est un modèle de prévision de séries temporelles **pré-entraîné et zero-shot**. On lui donne le passé d'une série, et il prévoit les pas suivants sans avoir été entraîné sur nos données.

- **Sortie probabiliste.** Il renvoie 21 quantiles par pas futur, du 1er au 99e centile, et pas un seul nombre. On obtient une bande de valeurs plausibles, pas seulement une meilleure estimation.
- **Plusieurs variables à la fois.** Une série peut porter plusieurs valeurs par pas. La nôtre en porte deux : la part de Ténacité et les pièces. Elles sont prévues ensemble.
- **Covariables.** Il accepte des signaux supplémentaires :
  - *covariables passées* : connues seulement jusqu'à maintenant, comme la Ténacité perdue au dernier combat ;
  - *covariables connues* : connues aussi pour le futur, comme « le prochain nœud est le boss ».
- **Quatre tailles :** 5M, 28M, 123M et 209M paramètres. Toutes tournent sur le CPU d'un portable en moins d'une seconde pour nos données.
- Code : <https://github.com/mistralai/timestral> (Apache 2.0). Poids : Hugging Face `mistralai/Timestral-*` (licence MIT modifiée).

## 2. Comment on l'utilise

La question : **à partir de la façon dont une partie s'est déroulée jusqu'ici, peut-on prévoir la suite ?** Et un modèle pré-entraîné fait-il mieux qu'une simple recherche dans des simulations passées ?

### La chaîne

```
scripts/simulate.ts --trace  ──►  simulation/<nom>-trace.csv  ──►  scripts/forecast/experiment.py
   (le bot joue des parties)        (une ligne par nœud de carte)      (prévisions, scores, graphiques)
                                                                              │
                                 simulation/forecast/: report.md, results.json, *.png  ◄─┘
```

La logique est dans le dépôt : l'option `--trace`, le script de l'expérience dans `scripts/forecast/` avec son `requirements.txt`, et ce guide. Les résultats n'y sont pas : les traces, l'environnement virtuel, les poids des modèles et les sorties de l'expérience sont tous dans `simulation/`, ignoré par git, et n'existent que sur la machine qui les a produits. Toutes les commandes ci-dessous se lancent depuis la racine du dépôt.

1. **Le simulateur écrit la trace.** Avec `--trace`, `npm run simulate` écrit une ligne par nœud de carte une fois résolu : après le combat, la boutique, l'événement ou le trésor.
2. **L'expérience construit les séries.** Pour chaque partie, elle prend :
   - les pas jusqu'à un **point de contrôle** : le contexte ;
   - les pas suivants : l'horizon à prévoir.
3. **Quatre prévisionnistes** prévoient chacun l'horizon (section 4).
4. **Ils sont notés** contre ce qui s'est réellement passé. Un changement planté teste si les prévisions savent repérer où une version du jeu a changé (section 6).

### Colonnes de la trace (`<nom>-trace.csv`)

| groupe | colonnes | sens |
|---|---|---|
| identifiants | `schema_version` (= 1), `seed`, `start_build`, `companions`, `step`, `level`, `column`, `node_kind`, `store_kind`, `enemies` | quelle partie, quel nœud. `step` compte depuis 0 sur toute la partie. `column` va de 1 à 16 par âge : mini-boss en 8, boss en 16. `enemies` liste les identifiants des créatures d'un combat, séparés par des espaces. |
| cibles | `alive`, `grit`, `max_grit`, `coins`, `deck_size`, `bucket_n`, `bucket_value` | l'état de la partie une fois le nœud résolu : en vie, Ténacité, Ténacité max, pièces, taille du deck, créatures du seau. `bucket_value` est la somme des prix de vente. |
| passé seulement | `fights_started`, `fights_won`, `grit_lost_last`, `turns_last`, `escapes_cum`, `caught_cum`, `equipment_n`, `waiting_n` | l'historique jusqu'ici : des compteurs, et la Ténacité perdue et les tours du dernier combat. |

Les lignes d'une partie **s'arrêtent là où elle se termine** : mort, fuite du boss ou victoire. La trace ne consomme aucun tirage aléatoire, donc les CSV de parties et de combats sont identiques à l'octet près, avec ou sans `--trace`.

### Ce qu'on prévoit

- **Cibles** (V = 2) :
  - `grit_frac` = `grit / max_grit`, la part de Ténacité, de 0 (mort) à 1 (pleine) ;
  - `coins`, les pièces.
- **Points de contrôle** (les âges du jeu sont `kid` enfant, `adult` adulte, `elder` ancien) :
  - `kid-mb` : après le mini-boss de l'âge enfant (colonne 8). On prévoit les colonnes 9 à 16 de l'âge enfant, donc H = 8. C'est le point de contrôle principal : la plupart des parties sont encore en vie à ce moment-là.
  - `adult` : après le boss de l'âge enfant (colonne 16). On prévoit les colonnes 1 à 16 de l'âge adulte, donc H = 16. Peu de parties y arrivent (30 sur 100 dans nos données).
- **Parties retenues :** en vie au point de contrôle, et la partie continue.
- **Vérité terrain après la fin d'une partie :**
  - après une mort, `grit_frac = 0` et les pièces sont reportées. Ces pas sont notés ;
  - après une fuite du boss, les dernières valeurs sont reportées. Ces pas **ne sont pas** notés.

## 3. Comment le lancer

### Installation (une fois)

```bash
uv venv simulation/.venv --python 3.12
```

```bash
uv pip install --python simulation/.venv/bin/python -r scripts/forecast/requirements.txt
```

Les poids des modèles se téléchargent à la première utilisation dans `simulation/.hf-cache` (environ 1,4 Go pour les quatre tailles).

### Générer les données

L'expérience lit trois traces :

- `tf-ref` : le jeu de référence ;
- `tf-a` : des parties tenues à l'écart, même version du jeu ;
- `tf-b` : les mêmes graines sur une version modifiée.

```bash
npm run simulate -- --runs 300 --seed 1 --trace --out tf-ref
```

```bash
npm run simulate -- --runs 100 --seed 1001 --trace --out tf-a
```

Pour `tf-b`, faites le changement de contenu à détecter, lancez la commande ci-dessous, puis annulez le changement.

```bash
npm run simulate -- --runs 100 --seed 1001 --trace --out tf-b
```

### Lancer l'expérience

```bash
simulation/.venv/bin/python scripts/forecast/experiment.py
```

Cela prend quelques secondes. On peut aussi ouvrir `scripts/forecast/experiment.py` dans VS Code : ses marqueurs `# %%` en font un notebook, qu'on peut exécuter cellule par cellule pour inspecter les tableaux.

### Ce qu'on peut changer dans `scripts/forecast/experiment.py`

- `PLANTED` : l'identifiant de la créature que le test planté cherche dans `enemies`.
- `CHECKPOINTS` : le contexte et l'horizon (âge, colonne) de chaque point de contrôle.
- Les tailles de modèle, dans `run()`.

### Utiliser Timestral directement

```python
from timestral import TimestralForecaster

f = TimestralForecaster.from_pretrained("mistralai/Timestral-5M", cache_dir="simulation/.hf-cache")
fc = f.forecast(
    context,                    # (B, V, T) : parties × variables × pas passés ; NaN = manquant
    prediction_length=H,
    past_covariates=P,          # optionnel, (B, C_past, T)
    known_covariates=K,         # optionnel, (B, C_known, T + H)
)
fc.quantiles        # tenseur (B, V, H, 21)
fc.quantile_levels  # (0.01, 0.05, 0.1, 0.15, …, 0.9, 0.95, 0.99)
fc.median           # (B, V, H)
fc.quantile(0.9)    # (B, V, H) à un niveau donné
```

- Les lignes de covariables connues qui ne contiennent que des 0 et des 1 sont traitées comme des indicateurs.
- `clip_nonnegative=True` est la valeur par défaut : une série qui n'a jamais été négative reste à 0 ou plus.
- Timestral ne sait rien d'autre des données. Il ne sait pas que la Ténacité est plafonnée à son maximum, ni qu'une partie s'arrête à la mort.

## 4. Ce qu'il fournit : les quatre prévisionnistes

Chaque prévisionniste donne, par partie, variable et pas d'horizon, les mêmes 21 niveaux de quantile.

| nom | ce que c'est | entrées |
|---|---|---|
| **L**, recherche | la référence, sans modèle | Les parties de référence dont la part de Ténacité au point de contrôle est dans le même quartile. Leurs valeurs réelles à chaque pas futur donnent les quantiles. |
| **T1**, Timestral | cibles seules | la part de Ténacité et les pièces de la partie jusqu'au point de contrôle. Lancé aux quatre tailles (`T1`, `T1-28M`, `T1-123M`, `T1-209M`). |
| **T2**, Timestral + covariables | 5M | T1, plus les covariables passées `grit_lost_last`, `fights_won` et `deck_size`, et les covariables connues `is_miniboss_col`, `is_boss_col` et `level_index` (toutes connues d'après la structure de la carte). |
| **T3**, oracle (avec fuite) | 5M | T2, plus si chaque nœud futur est un combat ou une boutique, lu dans la trace réelle. Ce n'est pas une prévision honnête : il montre combien connaître la carte future aiderait. |

## 5. Comment lire les résultats

### Fichiers produits (`simulation/forecast/`)

| fichier | contenu |
|---|---|
| `report.md` | verdict, tableaux de mesures, tableau de l'effet planté, choix et réserves |
| `results.json` | tous les chiffres du rapport : nombres de parties, mesures par prévisionniste, couverture par pas, listes du test planté avec les graines |
| `fan-<point>.png` | éventails de la part de Ténacité, L à côté de T2 |
| `coverage-<point>.png` | couverture des bandes par pas d'horizon |
| `out-of-band-<point>.png` | histogrammes du score hors bande, A contre B |
| `run.log` | la sortie console du dernier lancement |

### Quantiles et bandes

La prévision d'un pas, ce sont 21 valeurs. Le quantile 0,5 est la **médiane** : la moitié des parties devrait tomber en dessous. Des paires de quantiles forment des **bandes** :

- **bande 10–90** (quantiles 0,1 et 0,9) : 80 % des résultats réels devraient tomber dedans ;
- **bande 5–95** : 90 % devraient tomber dedans.

Une bande étroite est une prévision sûre d'elle ; une bande large, une prévision incertaine. Une prévision n'est utile que si ses bandes sont **à la fois étroites et honnêtes**.

### Couverture : les bandes sont-elles honnêtes ?

La **couverture** est la part des résultats réels tombés dans une bande, sur tous les pas notés de toutes les parties.

- Une bande 10–90 **calibrée** couvre environ 80 %, et une bande 5–95 environ 90 %. On accepte ±5 points.
- **Trop haute** (95 % pour une bande à 80 %) : les bandes sont trop larges. Le modèle est honnête mais vague.
- **Trop basse** (60 % pour une bande à 80 %) : les bandes sont trop étroites. Le modèle est trop sûr de lui, et ses résultats « improbables » arrivent souvent.

Dans le rapport, `cov 80` et `cov 90` portent sur la part de Ténacité, et `cov 80 coins` sur les pièces. Le graphique de couverture montre la même chose pas par pas ; la zone grise est la cible à ±5 points. Une courbe qui dérive avec le pas montre que le modèle est calibré près du point de contrôle mais pas plus loin, ou l'inverse.

### Perte pinball : la précision globale

La **perte pinball** (perte de quantile) note les 21 quantiles à la fois. Chaque quantile est pénalisé quand le résultat tombe du mauvais côté, en proportion de son niveau. Elle récompense les bandes à la fois étroites et bien placées.

- **Plus bas, c'est mieux.** Elle ne se compare que pour une même variable : la part de Ténacité (0 à 1) et les pièces n'ont pas la même échelle.
- Règle simple : couverture correcte mais pinball moins bonne, les bandes sont trop larges. Les deux mauvaises, les bandes sont mal placées.

### Prédiction de la mort et AUC

Chaque prévisionniste donne à chaque partie une probabilité de mourir avant la fin de l'horizon.

- **L :** la part des parties voisines qui sont mortes.
- **Timestral :** une **approximation grossière**, la part de ses 21 niveaux de quantile dont la part de Ténacité descend à 0,02 ou moins à un pas. Ce n'est pas une vraie probabilité.

L'**AUC** demande si les parties mortes ont reçu un score plus haut que les parties survivantes. 0,5, c'est pile ou face ; 1,0 les sépare parfaitement. Il faut assez de parties dans les deux groupes. Au point de contrôle `adult`, 29 parties sur 30 meurent, donc l'AUC n'y veut rien dire.

### L'éventail

- La bande colorée montre les plages 5–95 (claire) et 10–90 (plus foncée) des prévisions, et la ligne leur médiane.
- Les lignes grises sont 10 parties réelles. Elles s'arrêtent quand une partie finit sans mourir ; après une mort, elles restent à 0.
- L'éventail est la **vue d'ensemble** : les quantiles de toutes les parties sont regroupés, puis recalculés par pas. Il montre ce que le prévisionniste attend des parties en général, pas d'une partie en particulier.

À lire ainsi :

- La plupart des lignes grises restent-elles dans la bande ?
- La bande est-elle bien plus large que l'écart entre les lignes grises ?
- Va-t-elle là où les valeurs sont impossibles ? La bande de Timestral qui dépasse 1,0 est le signe le plus net qu'il ignore le plafond de Ténacité.

### Le test de l'effet planté

Ce test vérifie si les prévisions savent **trouver où une version du jeu a changé**. `tf-a` et `tf-b` utilisent les mêmes graines ; dans `tf-b`, une créature est rendue plus forte. Leurs contextes (jusqu'au point de contrôle) sont identiques, donc chaque prévisionniste donne la même prévision pour les deux. Seuls les résultats réels diffèrent.

1. **Score hors bande**, par partie : la part de ses pas notés dont la part de Ténacité sort de la bande 5–95. 0 veut dire que tout était attendu ; 1, que chaque pas a surpris le modèle.
2. **Référence nulle :** les scores sur `tf-a`, la version inchangée. Même là, certaines parties surprennent.
3. **Liste restreinte :** les parties de `tf-b` dont le score dépasse le 95e centile des scores de `tf-a`. Ce sont les parties « anormalement surprenantes ».
4. **Touché :** une partie de la liste compte comme touchée si la créature plantée est dans le combat de son premier pas hors bande, ou du pas d'avant.
5. **Précision :** la part des parties de la liste qui sont touchées.

Comment le lire :

- **Histogrammes :** si les barres de B sont à droite de celles de A, le changement a rendu les parties surprenantes. Si les deux se superposent, rien n'a été détecté. La ligne pointillée est le 95e centile de A.
- **Taille de la liste :** environ 5 % des parties de B y tombent par simple hasard. Seul un nombre plus grand, avec des touchés, désigne le changement.
- **Précision :** 0 % avec une toute petite liste veut dire que rien n'a été trouvé. `simulation/forecast/results.json` donne les graines retenues et leur premier pas signalé.
- **Puissance :** le test ne peut trouver qu'un changement que les parties rencontrent assez souvent. Regardez combien de parties de B ont croisé la créature plantée dans l'horizon (`planted_met` dans `simulation/forecast/results.json`).

## 6. Ce qu'on a trouvé (octobre 2026)

Tous les chiffres sont dans `simulation/forecast/report.md` (en anglais), sur la machine qui a lancé l'expérience. En bref :

- **La recherche bat Timestral sur la Ténacité.** Sa perte pinball est 40 à 65 % plus basse. Les bandes de Timestral sont trop larges et dépassent 1,0, parce qu'il ne connaît ni le plafond ni la fréquence des morts.
- **Timestral n'a l'air mieux calibré à `kid-mb` que parce qu'il est trop large** (86 à 92 % de couverture pour une cible de 80 %). Sur les pièces, il est trop sûr de lui (43 à 68 %).
- **Les covariables n'apportent rien de mesurable.** T2 et même T3, avec fuite, notent comme T1.
- **La taille du modèle n'aide pas.** De 5M à 209M, les chiffres sont proches, tous en moins d'une seconde de CPU.
- **Aucune méthode n'a trouvé la créature plantée.** L'arowana asiatique renforcé n'a été croisé que par 4 parties sur 100, et les 4 sont mortes à l'âge adulte de toute façon. Le détecter demanderait bien plus de parties, ou un changement que les parties rencontrent souvent.

Pistes pas encore essayées :

- borner la part de Ténacité de Timestral à [0, 1] ;
- prévoir l'évolution des pièces depuis le point de contrôle plutôt que leur total ;
- utiliser des contextes plus longs, avec des points de contrôle plus tardifs dans des simulations plus grandes.
