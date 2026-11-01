import { MASTERED, PAIRS, type Pair, type Progress, grade, hint, key, planSession, today } from './engine'

const STORE = 'tables-multiplication'
const app = document.querySelector<HTMLElement>('#app')!

function load(): Progress {
  try {
    const data = JSON.parse(localStorage.getItem(STORE) ?? '{}')
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(progress))
  } catch {
    // navigation privée ou stockage plein : la séance continue, la progression ne sera pas gardée
  }
}

let progress = load()
let day = today()
let session = { fresh: [] as Pair[], queue: [] as Pair[], graded: new Set<string>(), right: 0, total: 0, discovered: 0, mastered: 0 }

// Pavé, clavier et boutons passent tous par onKey : '0'-'9', 'del' ou 'ok'.
let onKey: ((k: string) => void) | null = null
app.addEventListener('click', (e) => {
  const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k
  if (k) onKey?.(k)
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target instanceof HTMLButtonElement) return // le bouton gère déjà Entrée
  const k = /^\d$/.test(e.key) ? e.key : e.key === 'Enter' ? 'ok' : e.key === 'Backspace' ? 'del' : null
  if (k) {
    e.preventDefault()
    onKey?.(k)
  }
})

let audio: AudioContext | undefined
function ding() {
  audio ??= new AudioContext()
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.frequency.value = 880
  gain.gain.setValueAtTime(0.15, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.3)
  osc.connect(gain).connect(audio.destination)
  osc.start()
  osc.stop(audio.currentTime + 0.3)
}

const PAD = `<div class="pad">
  ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}
  <button data-k="del" aria-label="Effacer">⌫</button><button data-k="0">0</button><button data-k="ok" class="ok">OK</button>
</div>`

const dots = (a: number, b: number) =>
  `<div class="dots" style="--cols:${b}" aria-hidden="true">${'<i></i>'.repeat(a * b)}</div>`

// Le temps compte jusqu'à la 1re touche : c'est le temps pour se souvenir, pas pour taper.
function input(done: (value: number, ms: number) => void) {
  const out = app.querySelector('#answer')!
  const start = performance.now()
  let typed = ''
  let first = 0
  onKey = (k) => {
    if (k === 'ok') {
      if (!typed) return
      onKey = null
      return done(Number(typed), first - start)
    }
    if (k === 'del') typed = typed.slice(0, -1)
    else if (typed.length < 3) {
      first ||= performance.now()
      typed += k
    }
    out.textContent = typed || '?'
  }
}

function home() {
  const head = (n: number) => `<b>${n}</b>`
  let cells = '<b>×</b>' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(head).join('')
  for (let a = 1; a <= 10; a++) {
    cells += head(a)
    for (let b = 1; b <= 10; b++) {
      const level = progress[key(a, b)]?.level ?? 0
      cells += `<span data-level="${level}">${level ? a * b : ''}</span>`
    }
  }
  const mastered = PAIRS.filter(([a, b]) => progress[key(a, b)]?.level === MASTERED).length
  app.innerHTML = `
    <h1>Tables de multiplication</h1>
    <div class="table" role="img" aria-label="${mastered} calculs maîtrisés sur 55">${cells}</div>
    <p class="legend"><span data-level="0"></span> pas encore vu <span data-level="1"></span> en cours <span data-level="5"></span> maîtrisé</p>
    <p>${mastered} / 55 calculs maîtrisés</p>
    <button class="big" data-k="ok">Jouer</button>`
  onKey = (k) => k === 'ok' && start()
}

function start() {
  day = today()
  const { fresh, queue } = planSession(progress, day)
  session = { fresh, queue, graded: new Set(), right: 0, total: 0, discovered: fresh.length, mastered: 0 }
  next()
}

function next() {
  const fresh = session.fresh.shift()
  if (fresh) return discover(fresh)
  const pair = session.queue.shift()
  if (pair) return ask(pair)
  summary()
}

function discover([a, b]: Pair, retry = false) {
  app.innerHTML = `
    <p class="tag" aria-live="polite">${retry ? 'Regarde bien l’astuce et réessaie' : 'Nouveau !'}</p>
    ${dots(a, b)}
    <p class="hint">${hint(a, b)}</p>
    <p class="question">${a} × ${b} = <span id="answer">?</span></p>
    ${PAD}`
  input((value) => {
    if (value !== a * b) return discover([a, b], true)
    progress[key(a, b)] = { level: 1, due: day + 1 }
    save()
    next()
  })
}

function ask(pair: Pair) {
  const [a, b] = Math.random() < 0.5 ? pair : [pair[1], pair[0]]
  app.innerHTML = `
    <p class="question">${a} × ${b} = <span id="answer">?</span></p>
    <p id="feedback" aria-live="polite"></p>
    ${PAD}`
  input((value, ms) => {
    const k = key(a, b)
    const right = value === a * b
    if (!session.graded.has(k)) {
      session.graded.add(k)
      session.total++
      if (right) session.right++
      const before = progress[k] ?? { level: 1, due: day }
      progress[k] = grade(before, right, ms, day)
      if (progress[k].level === MASTERED && before.level < MASTERED) session.mastered++
      save()
    }
    if (!right) {
      session.queue.splice(3, 0, pair) // le fait revient 3 questions plus loin
      return correction(a, b)
    }
    ding()
    app.querySelector('#answer')!.classList.add('ok')
    app.querySelector('#feedback')!.textContent = 'Bravo !'
    setTimeout(next, 700)
  })
}

function correction(a: number, b: number) {
  app.innerHTML = `
    <p class="tag">Presque ! Regarde :</p>
    <p class="question" aria-live="polite">${a} × ${b} = <strong>${a * b}</strong></p>
    ${dots(a, b)}
    <p class="hint">${hint(a, b)}</p>
    <button class="big" data-k="ok">Continuer</button>`
  onKey = (k) => k === 'ok' && next()
}

function summary() {
  const { right, total, discovered, mastered } = session
  const stars = !total || right / total >= 0.9 ? 3 : right / total >= 0.7 ? 2 : 1
  app.innerHTML = `
    <p class="stars" aria-label="${stars} étoiles sur 3">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
    <p>${right} bonne${right > 1 ? 's' : ''} réponse${right > 1 ? 's' : ''} du premier coup sur ${total}</p>
    ${discovered ? `<p>Tu as découvert ${discovered} nouveau${discovered > 1 ? 'x' : ''} calcul${discovered > 1 ? 's' : ''}.</p>` : ''}
    ${mastered ? `<p>${mastered} calcul${mastered > 1 ? 's' : ''} maîtrisé${mastered > 1 ? 's' : ''} en plus !</p>` : ''}
    <button class="big" data-k="ok">Retour</button>`
  onKey = (k) => k === 'ok' && home()
}

home()
