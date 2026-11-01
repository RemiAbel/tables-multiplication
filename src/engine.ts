// Moteur d'apprentissage : ordre d'introduction, boîtes de Leitner, composition d'une séance, astuces.

export type Pair = [number, number] // toujours a <= b : 3×7 et 7×3 sont le même fait
export type Card = { level: number; due: number } // due = numéro de jour
export type Progress = Record<string, Card>

export const MASTERED = 5
export const FAST_MS = 3000 // temps jusqu'à la 1re touche : au-delà, l'enfant calcule au lieu de se souvenir
export const SESSION_SIZE = 20
const NEW_MAX = 4 // nouveaux faits par séance
const NEW_MAX_RULE = 5 // ×1 et ×10 sont des règles, pas des faits à retenir un par un : on va plus vite
const LEARNING_MAX = 8 // pas de nouveau fait tant que trop de faits sont fragiles (niveau 1)
const INTERVALS = [0, 1, 2, 4, 8, 16] // jours avant de revoir un fait, par niveau
const ONE_TO_TEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// Faits de base d'abord, puis ceux qu'on en déduit.
// ×7 n'a pas d'étape : tous ses faits sont déjà couverts par les autres tables.
const ORDER = [1, 10, 2, 5, 'carré', 3, 4, 9, 6, 8] as const
type Step = (typeof ORDER)[number]

const inStep = (step: Step, a: number, b: number) => (step === 'carré' ? a === b : a === step || b === step)
const stepOf = (a: number, b: number) => ORDER.find((s) => inStep(s, a, b))!
export const isRule = ([a, b]: Pair) => [1, 10].includes(stepOf(a, b) as number)

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
export function grade(card: Card, correct: boolean, ms: number, day: number, limit = FAST_MS): Card {
  if (!correct) return { level: 1, due: day + 1 }
  if (card.due > day) return card
  const level = ms < limit ? Math.min(card.level + 1, MASTERED) : card.level
  return { level, due: day + INTERVALS[level] }
}

// Seuil adapté à l'enfant : son temps sur ×1 et ×10, qu'il n'a pas à calculer, mesure sa vitesse de lecture et de frappe.
export function speedLimit(ruleTimes: number[]): number {
  if (ruleTimes.length < 5) return FAST_MS
  const median = [...ruleTimes].sort((a, b) => a - b)[Math.floor(ruleTimes.length / 2)]
  return Math.min(5000, Math.max(FAST_MS, median + 1500))
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// fresh = faits à découvrir ; queue = questions (nouveaux et dus, complétés par des faits connus, puis les nouveaux
// une 2e fois en fin de séance) ; problem = un fait connu à mettre en situation.
export function planSession(p: Progress, day: number, rand = Math.random) {
  const card = ([a, b]: Pair) => p[key(a, b)]
  const known = PAIRS.filter(card)
  const due = known.filter((x) => card(x).due <= day).sort((x, y) => card(x).level - card(y).level)
  const learning = known.filter((x) => card(x).level === 1 && !isRule(x)).length
  const unseen = PAIRS.filter((x) => !card(x))
  const rule = unseen.length > 0 && isRule(unseen[0])
  const room = Math.max(0, Math.min(rule ? NEW_MAX_RULE : NEW_MAX, LEARNING_MAX - learning))
  const fresh = unseen.filter((x) => isRule(x) === rule).slice(0, room)
  const filler = shuffle(known.filter((x) => card(x).due > day), rand)
  const queue = [
    ...shuffle([...fresh, ...due, ...filler].slice(0, SESSION_SIZE - fresh.length), rand),
    ...shuffle(fresh, rand),
  ]
  const problem = shuffle(known.filter(([a, b]) => a >= 2 && a * b <= 40), rand)[0]
  return { fresh, queue, problem }
}

export function hint(a: number, b: number): string {
  const [x, y] = a <= b ? [a, b] : [b, a]
  const step = stepOf(x, y)
  const n = step === x ? y : x // l'autre facteur
  const p = a * b
  const tips: Record<Step, string> = {
    1: `Multiplier par 1 ne change rien : 1 × ${n} = ${p}`,
    10: `× 10, on ajoute un zéro : ${n} × 10 = ${p}`,
    2: `× 2, c'est le double : ${n} + ${n} = ${p}`,
    5: `× 5, c'est la moitié de × 10 : la moitié de ${n * 10} = ${p}`,
    carré: `C'est un carré : ${n} rangées de ${n} = ${p}`,
    3: `× 3, c'est × 2 et encore une fois : ${2 * n} + ${n} = ${p}`,
    4: `× 4, c'est le double du double : ${2 * n} + ${2 * n} = ${p}`,
    9: `× 9, c'est × 10 moins une fois : ${10 * n} − ${n} = ${p}`,
    6: `× 6, c'est × 5 et encore une fois : ${5 * n} + ${n} = ${p}`,
    8: `× 8, c'est le double de × 4 : ${4 * n} + ${4 * n} = ${p}`,
  }
  // « Presque un carré » (6 × 7 = 6 × 6 + 6), seulement si le carré a déjà été appris
  const nearSquare = y === x + 1 && ORDER.indexOf(step) > ORDER.indexOf('carré')
  return nearSquare ? `${tips[step]}. Autre astuce, presque un carré : ${x} × ${x} + ${x} = ${p}` : tips[step]
}

// Erreur classique : donner le résultat d'un calcul voisin (6 × 7 → 48). Le nommer aide à séparer les deux.
export function confusion(a: number, b: number, answer: number): string | null {
  if (answer === a * b) return null
  for (const x of [a, b]) {
    const other = answer / x
    if (ONE_TO_TEN.includes(other)) return `${answer}, c'est ${x} × ${other}`
  }
  return null
}

export const tablesDone = (p: Progress) =>
  ONE_TO_TEN.filter((n) => ONE_TO_TEN.every((m) => p[key(n, m)]?.level === MASTERED))

// Jours joués d'affilée jusqu'à aujourd'hui, ou jusqu'à hier si l'enfant n'a pas encore joué aujourd'hui
export function streak(days: number[], day: number): number {
  const played = new Set(days)
  let d = played.has(day) ? day : day - 1
  let n = 0
  while (played.has(d--)) n++
  return n
}
