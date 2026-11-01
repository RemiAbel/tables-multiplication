import { describe, expect, it } from 'vitest'
import {
  FAST_MS,
  MASTERED,
  PAIRS,
  SESSION_SIZE,
  confusion,
  grade,
  hint,
  isRule,
  key,
  planSession,
  speedLimit,
  streak,
  tablesDone,
  type Progress,
} from './engine'

const progressOf = (pairs: typeof PAIRS, level: number, due = 0): Progress =>
  Object.fromEntries(pairs.map(([a, b]) => [key(a, b), { level, due }]))

describe('PAIRS', () => {
  it('couvre les 55 faits de 1×1 à 10×10, sans doublon', () => {
    expect(PAIRS).toHaveLength(55)
    expect(new Set(PAIRS.map(([a, b]) => key(a, b))).size).toBe(55)
  })

  it('suit l’ordre : ×1, puis ×10, … et 7×8 en dernier', () => {
    expect(PAIRS.slice(0, 10).every(([a]) => a === 1)).toBe(true)
    expect(PAIRS[10]).toEqual([2, 10])
    expect(PAIRS.at(-1)).toEqual([7, 8])
  })

  it('×1 et ×10 sont des règles, les 19 premiers faits', () => {
    expect(PAIRS.filter(isRule)).toEqual(PAIRS.slice(0, 19))
  })
})

describe('grade', () => {
  const day = 100
  const due = { level: 2, due: day }

  it('monte d’un niveau si juste et rapide', () => {
    expect(grade(due, true, FAST_MS - 1, day)).toEqual({ level: 3, due: day + 4 })
  })
  it('reste au même niveau si juste mais lent', () => {
    expect(grade(due, true, FAST_MS, day)).toEqual({ level: 2, due: day + 2 })
  })
  it('utilise le seuil adapté à l’enfant', () => {
    expect(grade(due, true, 3500, day, 4000).level).toBe(3)
  })
  it('redescend au niveau 1 si faux, même pas encore dû', () => {
    expect(grade({ level: 4, due: day + 5 }, false, 500, day)).toEqual({ level: 1, due: day + 1 })
  })
  it('ne bouge pas un fait pas encore dû', () => {
    const card = { level: 3, due: day + 2 }
    expect(grade(card, true, 500, day)).toBe(card)
  })
  it('plafonne à maîtrisé', () => {
    expect(grade({ level: MASTERED, due: day }, true, 500, day).level).toBe(MASTERED)
  })
})

describe('speedLimit', () => {
  it('3 s tant qu’on n’a pas assez de mesures', () => {
    expect(speedLimit([4000, 4000])).toBe(FAST_MS)
  })
  it('médiane + 1,5 s, entre 3 et 5 s', () => {
    expect(speedLimit([900, 1000, 1100, 1000, 1000])).toBe(FAST_MS)
    expect(speedLimit([2500, 2400, 2600, 2500, 9000])).toBe(4000)
    expect(speedLimit([6000, 6000, 6000, 6000, 6000])).toBe(5000)
  })
})

describe('planSession', () => {
  const rand = () => 0.5

  it('1re séance : 5 faits ×1 à découvrir, chacun reposé 2 fois', () => {
    const { fresh, queue, problem } = planSession({}, 0, rand)
    expect(fresh).toEqual(PAIRS.slice(0, 5))
    expect(queue).toHaveLength(10)
    expect(problem).toBeUndefined()
  })

  it('les règles fragiles ne bloquent pas les suivantes', () => {
    expect(planSession(progressOf(PAIRS.slice(0, 5), 1), 0, rand).fresh).toEqual(PAIRS.slice(5, 10))
  })

  it('après les règles : 4 nouveaux faits à la fois', () => {
    expect(planSession(progressOf(PAIRS.slice(0, 19), MASTERED, 99), 0, rand).fresh).toEqual(PAIRS.slice(19, 23))
  })

  it('aucun nouveau fait quand 8 faits sont fragiles', () => {
    const p = { ...progressOf(PAIRS.slice(0, 19), MASTERED, 99), ...progressOf(PAIRS.slice(19, 27), 1) }
    expect(planSession(p, 0, rand).fresh).toEqual([])
  })

  it('les faits dus passent avant les autres et la séance est limitée', () => {
    const p = { ...progressOf(PAIRS.slice(0, 5), 3, 0), ...progressOf(PAIRS.slice(5, 40), 3, 10) }
    const { queue } = planSession(p, 0, rand)
    expect(queue).toHaveLength(SESSION_SIZE)
    for (const [a, b] of PAIRS.slice(0, 5)) expect(queue).toContainEqual([a, b])
  })

  it('le petit problème porte sur un fait connu, ni ×1 ni trop gros', () => {
    const { problem } = planSession(progressOf(PAIRS.slice(0, 30), 3, 10), 0, rand)
    expect(problem).toBeDefined()
    const [a, b] = problem!
    expect(a).toBeGreaterThanOrEqual(2)
    expect(a * b).toBeLessThanOrEqual(40)
  })
})

describe('hint', () => {
  it('donne le bon résultat pour chaque fait, dans les deux sens', () => {
    for (const [a, b] of PAIRS) {
      expect(hint(a, b)).toMatch(new RegExp(`= ${a * b}$`))
      expect(hint(b, a)).toMatch(new RegExp(`= ${a * b}$`))
    }
  })

  it('propose « presque un carré » seulement après les carrés', () => {
    expect(hint(6, 7)).toContain('6 × 6 + 6 = 42')
    expect(hint(4, 5)).not.toContain('presque')
  })
})

describe('confusion', () => {
  it('nomme le calcul voisin', () => {
    expect(confusion(6, 7, 48)).toBe("48, c'est 6 × 8")
    expect(confusion(6, 7, 49)).toBe("49, c'est 7 × 7")
  })
  it('rien si la réponse est juste ou sans lien', () => {
    expect(confusion(6, 7, 42)).toBeNull()
    expect(confusion(6, 7, 43)).toBeNull()
    expect(confusion(6, 7, 0)).toBeNull()
  })
})

describe('tablesDone', () => {
  it('liste les tables entièrement maîtrisées', () => {
    expect(tablesDone(progressOf(PAIRS.slice(0, 19), MASTERED))).toEqual([1, 10])
  })
})

describe('streak', () => {
  const day = 100
  it('compte les jours d’affilée jusqu’à aujourd’hui', () => {
    expect(streak([], day)).toBe(0)
    expect(streak([day], day)).toBe(1)
    expect(streak([day, day - 1, day - 3], day)).toBe(2)
  })
  it('reste valable si l’enfant a joué hier mais pas encore aujourd’hui', () => {
    expect(streak([day - 1, day - 2], day)).toBe(2)
    expect(streak([day - 2], day)).toBe(0)
  })
})
