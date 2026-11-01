import {
  MASTERED,
  PAIRS,
  type Pair,
  type Progress,
  confusion,
  grade,
  hint,
  isRule,
  key,
  planSession,
  speedLimit,
  streak,
  tablesDone,
  today,
} from './engine'

const STORE = 'tables-multiplication'
const SETTINGS = 'tables-multiplication-reglages'
const app = document.querySelector<HTMLElement>('#app')!

function load<T extends object>(name: string, fallback: T): T {
  try {
    const data = JSON.parse(localStorage.getItem(name) ?? 'null')
    return data && typeof data === 'object' ? { ...fallback, ...data } : fallback
  } catch {
    return fallback
  }
}

function save(name: string, value: unknown) {
  try {
    localStorage.setItem(name, JSON.stringify(value))
  } catch {
    // navigation privée ou stockage plein : la séance continue, la progression ne sera pas gardée
  }
}

let progress: Progress = load(STORE, {})
// times = derniers temps de réponse sur ×1 et ×10 (pour le seuil de vitesse) ; days = jours joués
const settings = load(SETTINGS, { voice: false, times: [] as number[], days: [] as number[] })
let day = today()
let session = newSession()

function newSession(): {
  fresh: Pair[]
  queue: Pair[]
  problem?: Pair
  graded: Set<string>
  right: number
  total: number
  discovered: number
  promoted: number
  mastered: number
  tablesBefore: number[]
} {
  return { fresh: [], queue: [], graded: new Set(), right: 0, total: 0, discovered: 0, promoted: 0, mastered: 0, tablesBefore: [] }
}

if (import.meta.env.PROD) navigator.serviceWorker?.register('./sw.js')

// Pavé, clavier et boutons passent tous par onKey : '0'-'9', 'del', 'ok', 'say' ou 'voice'.
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

// Lit le texte si la voix est activée ; then() est appelé à la fin de la lecture.
function say(text: string, then?: () => void) {
  if (!settings.voice || !('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const spoken = text
    .replace(/([×=]) \?/g, '$1 combien')
    .replace(/×/g, ' fois ')
    .replace(/−/g, ' moins ')
    .replace(/=/g, ' égale ')
  const utterance = new SpeechSynthesisUtterance(spoken)
  utterance.lang = 'fr-FR'
  if (then) utterance.onend = then
  speechSynthesis.speak(utterance)
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n > 1 ? many : one}`

const sayButton = () => (settings.voice ? '<button class="say" data-k="say" aria-label="Réécouter">🔊</button>' : '')

const PAD = `<div class="pad">
  ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}
  <button data-k="del" aria-label="Effacer">⌫</button><button data-k="0">0</button><button data-k="ok" class="ok">OK</button>
</div>`

const dots = (a: number, b: number) =>
  `<div class="dots" style="--cols:${b}" aria-hidden="true">${'<i></i>'.repeat(a * b)}</div>`

// Lit la question puis attend la réponse. Le temps compte jusqu'à la 1re touche, après la fin de la lecture :
// c'est le temps pour se souvenir, pas pour écouter ou taper.
function input(text: string, done: (value: number, ms: number) => void) {
  const out = app.querySelector('#answer')!
  let start = performance.now()
  let typed = ''
  let first = 0
  const restart = () => (start = performance.now())
  onKey = (k) => {
    if (k === 'say') return say(text, restart)
    if (k === 'ok') {
      if (!typed) return
      onKey = null
      return done(Number(typed), Math.max(0, first - start))
    }
    if (k === 'del') typed = typed.slice(0, -1)
    else if (typed.length < 3) {
      first ||= performance.now()
      typed += k
    }
    out.textContent = typed || '?'
  }
  say(text, restart)
}

function cheer() {
  ding()
  app.querySelector('#answer')!.classList.add('ok')
  app.querySelector('#feedback')!.textContent = 'Bravo !'
  setTimeout(next, 700)
}

function week() {
  const offset = (new Date().getDay() + 6) % 7 // lundi = 0
  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((letter, i) => [letter, settings.days.includes(day - offset + i)] as const)
  const played = days.filter(([, p]) => p).length
  return `<div class="week" role="img" aria-label="Cette semaine : ${plural(played, 'jour')} d'entraînement">
    ${days.map(([letter, p]) => `<span class="${p ? 'played' : ''}">${letter}<b>${p ? '★' : '·'}</b></span>`).join('')}
  </div>${streakLine()}`
}

// Affichée à partir de 2 jours ; une série cassée disparaît sans message
function streakLine(cheer = '') {
  const n = streak(settings.days, day)
  return n >= 2 ? `<p class="streak">🔥 ${n} jours d'affilée${cheer}</p>` : ''
}

function home() {
  day = today()
  const head = (n: number) => `<b>${n}</b>`
  let cells = '<b>×</b>' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(head).join('')
  for (let a = 1; a <= 10; a++) {
    cells += head(a)
    for (let b = 1; b <= 10; b++) {
      const level = progress[key(a, b)]?.level ?? 0
      // chaque case maîtrisée dévoile son morceau de l'image cachée
      cells += `<span data-level="${level}" style="--x:${((b - 1) * 100) / 9}%;--y:${((a - 1) * 100) / 9}%">${level ? a * b : ''}</span>`
    }
  }
  const mastered = PAIRS.filter(([a, b]) => progress[key(a, b)]?.level === MASTERED).length
  const done = tablesDone(progress)
  app.innerHTML = `
    <h1>Tables de multiplication</h1>
    ${week()}
    <div class="table" role="img" aria-label="${mastered} calculs maîtrisés sur 55">${cells}</div>
    <p class="legend"><span data-level="0"></span> pas encore vu <span data-level="1"></span> en cours <span data-level="5"></span> maîtrisé</p>
    <p>${mastered} / 55 calculs maîtrisés</p>
    ${done.length ? `<p class="badges">${done.map((n) => `<span>🏅 Table de ${n}</span>`).join('')}</p>` : ''}
    <button class="big" data-k="ok">Jouer</button>
    <button class="toggle" data-k="voice" aria-pressed="${settings.voice}">🔊 Lire les questions : ${settings.voice ? 'oui' : 'non'}</button>`
  onKey = (k) => {
    if (k === 'ok') start()
    if (k === 'voice') {
      settings.voice = !settings.voice
      save(SETTINGS, settings)
      home()
    }
  }
}

function start() {
  day = today()
  const { fresh, queue, problem } = planSession(progress, day)
  session = { ...newSession(), fresh, queue, problem, discovered: fresh.length, tablesBefore: tablesDone(progress) }
  next()
}

function next() {
  const fresh = session.fresh.shift()
  if (fresh) return discover(fresh)
  const pair = session.queue.shift()
  if (pair) return ask(pair)
  const problem = session.problem
  session.problem = undefined
  if (problem) return story(problem)
  summary()
}

function discover([a, b]: Pair, retry = false) {
  app.innerHTML = `
    <p class="tag" aria-live="polite">${retry ? 'Regarde bien l’astuce et réessaie' : 'Nouveau !'}</p>
    ${dots(a, b)}
    <p class="hint">${hint(a, b)}</p>
    <p class="question">${a} × ${b} = <span id="answer">?</span>${sayButton()}</p>
    ${PAD}`
  input(`${hint(a, b)}. ${a} × ${b} = ?`, (value) => {
    if (value !== a * b) return discover([a, b], true)
    progress[key(a, b)] = { level: 1, due: day + 1 }
    save(STORE, progress)
    next()
  })
}

function ask(pair: Pair) {
  const [a, b] = Math.random() < 0.5 ? pair : [pair[1], pair[0]]
  const k = key(a, b)
  // Dans les deux sens (6 × ? = 24), seulement pour un fait déjà bien connu
  const missing = (progress[k]?.level ?? 0) >= 3 && Math.random() < 1 / 3
  const expected = missing ? b : a * b
  app.innerHTML = `
    <p class="question">${missing ? `${a} × <span id="answer">?</span> = ${a * b}` : `${a} × ${b} = <span id="answer">?</span>`}${sayButton()}</p>
    <p id="feedback" aria-live="polite"></p>
    ${PAD}`
  input(missing ? `${a} × ? = ${a * b}` : `${a} × ${b} = ?`, (value, ms) => {
    const right = value === expected
    if (!session.graded.has(k)) {
      session.graded.add(k)
      session.total++
      if (right) session.right++
      const before = progress[k] ?? { level: 1, due: day }
      progress[k] = grade(before, right, ms, day, speedLimit(settings.times))
      if (progress[k].level > before.level) session.promoted++
      if (progress[k].level === MASTERED && before.level < MASTERED) session.mastered++
      save(STORE, progress)
    }
    if (right && !missing && isRule(pair)) {
      settings.times = [...settings.times, ms].slice(-10)
      save(SETTINGS, settings)
    }
    if (right) return cheer()
    session.queue.splice(3, 0, pair) // le fait revient 3 questions plus loin
    const note = missing ? (value >= 1 && value <= 10 ? `${a} × ${value} = ${a * value}` : null) : confusion(a, b, value)
    correction(a, b, note)
  })
}

function correction(a: number, b: number, note: string | null = null) {
  const text = `${a} × ${b} = ${a * b}. ${hint(a, b)}`
  app.innerHTML = `
    <p class="tag">Presque ! Regarde :</p>
    ${note ? `<p class="note">Attention : ${note}.</p>` : ''}
    <p class="question" aria-live="polite">${a} × ${b} = <strong>${a * b}</strong>${sayButton()}</p>
    ${dots(a, b)}
    <p class="hint">${hint(a, b)}</p>
    <button class="big" data-k="ok">Continuer</button>`
  onKey = (k) => (k === 'say' ? say(text) : k === 'ok' && next())
  say(text)
}

const STORIES: [string, (a: number, b: number) => string][] = [
  ['🥚', (a, b) => `${a} boîtes de ${b} œufs. Combien d'œufs en tout ?`],
  ['🔵', (a, b) => `${a} sachets de ${b} billes. Combien de billes en tout ?`],
  ['🍪', (a, b) => `${a} assiettes de ${b} gâteaux. Combien de gâteaux en tout ?`],
  ['🌷', (a, b) => `${a} vases de ${b} fleurs. Combien de fleurs en tout ?`],
]

// Petit problème en fin de séance : utiliser la multiplication dans une situation. Non noté.
function story(pair: Pair) {
  const [a, b] = Math.random() < 0.5 ? pair : [pair[1], pair[0]]
  const [emoji, text] = STORIES[Math.floor(Math.random() * STORIES.length)]
  app.innerHTML = `
    <p class="tag">Petit problème</p>
    <p class="hint">${text(a, b)}${sayButton()}</p>
    <div class="groups" aria-hidden="true">${`<span>${emoji.repeat(b)}</span>`.repeat(a)}</div>
    <p class="question"><span id="answer">?</span></p>
    <p id="feedback" aria-live="polite"></p>
    ${PAD}`
  input(text(a, b), (value) => (value === a * b ? cheer() : correction(a, b)))
}

function summary() {
  const { right, total, discovered, promoted, mastered, tablesBefore } = session
  // Les étoiles récompensent l'effort et les progrès, pas seulement la réussite
  const stars = 1 + (discovered + promoted > 0 ? 1 : 0) + (!total || right / total >= 0.8 ? 1 : 0)
  const newTables = tablesDone(progress).filter((n) => !tablesBefore.includes(n))
  if (!settings.days.includes(day)) {
    settings.days = [...settings.days, day]
    save(SETTINGS, settings)
  }
  app.innerHTML = `
    <p class="stars" aria-label="${stars} étoiles sur 3">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
    ${streakLine(' !')}
    ${newTables.map((n) => `<p class="badge-new">🏅 Table de ${n} maîtrisée !</p>`).join('')}
    <p>${plural(right, 'bonne réponse', 'bonnes réponses')} du premier coup sur ${total}</p>
    ${discovered ? `<p>Tu as découvert ${plural(discovered, 'nouveau calcul', 'nouveaux calculs')}.</p>` : ''}
    ${promoted ? `<p>${plural(promoted, 'calcul')} ${promoted > 1 ? 'ont' : 'a'} progressé${mastered ? `, dont ${mastered} maîtrisé${mastered > 1 ? 's' : ''}` : ''} !</p>` : ''}
    <button class="big" data-k="ok">Retour</button>`
  onKey = (k) => k === 'ok' && home()
  if (newTables.length) ding()
}

home()
