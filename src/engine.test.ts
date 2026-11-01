import { describe, expect, it } from 'vitest'
import { FAST_MS, MASTERED, PAIRS, SESSION_SIZE, grade, hint, key, planSession, type Progress } from './engine'

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

describe('planSession', () => {
  const rand = () => 0.5

  it('1re séance : 3 nouveaux faits à découvrir', () => {
    const { fresh, queue } = planSession({}, 0, rand)
    expect(fresh).toEqual(PAIRS.slice(0, 3))
    expect(queue).toHaveLength(3)
  })

  it('aucun nouveau fait quand 6 faits sont fragiles', () => {
    const p: Progress = Object.fromEntries(PAIRS.slice(0, 6).map(([a, b]) => [key(a, b), { level: 1, due: 0 }]))
    expect(planSession(p, 0, rand).fresh).toEqual([])
  })

  it('les faits dus passent avant les autres et la séance est limitée', () => {
    const p: Progress = Object.fromEntries(
      PAIRS.slice(0, 40).map(([a, b], i) => [key(a, b), { level: 3, due: i < 5 ? 0 : 10 }]),
    )
    const { queue } = planSession(p, 0, rand)
    expect(queue).toHaveLength(SESSION_SIZE)
    for (const [a, b] of PAIRS.slice(0, 5)) expect(queue).toContainEqual([a, b])
  })
})

describe('hint', () => {
  it('donne le bon résultat pour chaque fait, dans les deux sens', () => {
    for (const [a, b] of PAIRS) {
      expect(hint(a, b)).toMatch(new RegExp(`= ${a * b}$`))
      expect(hint(b, a)).toMatch(new RegExp(`= ${a * b}$`))
    }
  })
})
