// Moteur d'apprentissage : ordre d'introduction, boîtes de Leitner, composition d'une séance, astuces.

export type Pair = [number, number] // toujours a <= b : 3×7 et 7×3 sont le même fait
export type Card = { level: number; due: number } // due = numéro de jour
export type Progress = Record<string, Card>

export const MASTERED = 5
export const FAST_MS = 3000 // temps jusqu'à la 1re touche : au-delà, l'enfant calcule au lieu de se souvenir
export const SESSION_SIZE = 20
const NEW_MAX = 3 // nouveaux faits par séance
const LEARNING_MAX = 6 // pas de nouveau fait tant que trop de faits sont fragiles (niveau 1)
const INTERVALS = [0, 1, 2, 4, 8, 16] // jours avant de revoir un fait, par niveau

// Faits de base d'abord, puis ceux qu'on en déduit.
// ×7 n'a pas d'étape : tous ses faits sont déjà couverts par les autres tables.
const ORDER = [1, 10, 2, 5, 'carré', 3, 4, 9, 6, 8] as const
type Step = (typeof ORDER)[number]

const inStep = (step: Step, a: number, b: number) => (step === 'carré' ? a === b : a === step || b === step)

export const key = (a: number, b: number) => (a <= b ? `${a}x${b}` : `${b}x${a}`)

export const PAIRS: Pair[] = (() => {
  const seen = new Set<string>()
  return ORDER.flatMap((step) => {
    const pairs: Pair[] = []
    for (let a = 1; a <= 10; a++)
      for (let b = a; b <= 10; b++)
        if (inStep(step, a, b) && !seen.has(key(a, b))) {
          seen.add(key(a, b))
          pairs.push([a, b])
        }
    return pairs
  })
})()

export const today = (now = new Date()) =>
  Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000)

// Seule la 1re réponse d'une séance est notée. Un fait pas encore dû ne monte pas (sinon on casse l'espacement),
// mais une erreur le fait toujours redescendre.
export function grade(card: Card, correct: boolean, ms: number, day: number): Card {
  if (!correct) return { level: 1, due: day + 1 }
  if (card.due > day) return card
  const level = ms < FAST_MS ? Math.min(card.level + 1, MASTERED) : card.level
  return { level, due: day + INTERVALS[level] }
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// fresh = faits à découvrir ; queue = questions de la séance (les faits dus d'abord, complétés par des faits déjà connus).
export function planSession(p: Progress, day: number, rand = Math.random) {
  const card = ([a, b]: Pair) => p[key(a, b)]
  const known = PAIRS.filter(card)
  const due = known.filter((x) => card(x).due <= day).sort((x, y) => card(x).level - card(y).level)
  const learning = known.filter((x) => card(x).level === 1).length
  const fresh = PAIRS.filter((x) => !card(x)).slice(0, Math.max(0, Math.min(NEW_MAX, LEARNING_MAX - learning)))
  const filler = shuffle(known.filter((x) => card(x).due > day), rand)
  const queue = shuffle([...fresh, ...due, ...filler].slice(0, SESSION_SIZE), rand)
  return { fresh, queue }
}

export function hint(a: number, b: number): string {
  const [x, y] = a <= b ? [a, b] : [b, a]
  const step = ORDER.find((s) => inStep(s, x, y))!
  const n = step === x ? y : x // l'autre facteur
  const p = a * b
  switch (step) {
    case 1: return `Multiplier par 1 ne change rien : 1 × ${n} = ${p}`
    case 10: return `× 10, on ajoute un zéro : ${n} × 10 = ${p}`
    case 2: return `× 2, c'est le double : ${n} + ${n} = ${p}`
    case 5: return `× 5, c'est la moitié de × 10 : la moitié de ${n * 10} = ${p}`
    case 'carré': return `C'est un carré : ${n} rangées de ${n} = ${p}`
    case 3: return `× 3, c'est × 2 et encore une fois : ${2 * n} + ${n} = ${p}`
    case 4: return `× 4, c'est le double du double : ${2 * n} + ${2 * n} = ${p}`
    case 9: return `× 9, c'est × 10 moins une fois : ${10 * n} − ${n} = ${p}`
    case 6: return `× 6, c'est × 5 et encore une fois : ${5 * n} + ${n} = ${p}`
    case 8: return `× 8, c'est le double de × 4 : ${4 * n} + ${4 * n} = ${p}`
  }
}
