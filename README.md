# Tables de multiplication

Web app pour apprendre les tables de 1 à 10 (7–10 ans). Une séance par jour d'environ 5 minutes ; l'app choisit seule quoi travailler.

En ligne : https://remiabel.github.io/tables-multiplication/ (redéployée par GitHub Actions à chaque push sur `main`).

## Principes (issus de la recherche)

- Les faits arrivent dans un ordre qui part des tables faciles : ×1, ×10, ×2, ×5, les carrés, ×3, ×4, ×9, ×6, ×8. Chaque nouveau fait est présenté avec une image (points) et une astuce.
- L'enfant tape la réponse de mémoire (pas de choix multiple), les faits sont mélangés.
- Boîtes de Leitner : juste et rapide (< 3 s avant la 1re touche) → le fait monte d'un niveau et revient plus tard ; faux → retour au niveau 1.
- Au plus 3 nouveaux faits par séance, aucun si 6 faits sont encore fragiles.
- Pas de chrono visible ; une erreur montre la correction et le fait revient 3 questions plus loin.

Le réglage se trouve en haut de [src/engine.ts](src/engine.ts).

## Commandes

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # tests du moteur
npm run build   # site statique dans dist/, à servir avec n'importe quel serveur web
```

La progression est enregistrée dans le navigateur (`localStorage`) : elle est propre à chaque appareil.
