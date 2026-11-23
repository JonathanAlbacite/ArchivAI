import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useState, useEffect, useMemo, useRef } from 'react'
import { ArrowLeft, Check, CheckCircle2, Clock, Flag, Lightbulb, RotateCcw, Sparkles, StickyNote, Trophy, XCircle } from 'lucide-react'
import { ChestArt } from '../components/Illustrations'
import { SceneBadge } from '../components/SceneIcon'
import { Alert, Badge, Button, Card, Confetti, EmptyState, HelpTip, Stat, Tabs } from '../components/ui'
import TrophyViewer from '../components/TrophyViewer'
import { API_URL, api, errorMessage } from '../lib/api'
import { getRole } from '../lib/session'
import { formatDate, formatDuration, plural } from '../lib/format'
import { SCORING, xpForRun } from '../lib/gamification'
import { getSceneMeta, sceneStyle, useEnvironments } from '../scenes'

// RunResults.jsx
//
// The results page of a finished run. The game (CampaignProgressTracker) sends the run to
// POST /api/campaigns/:id/results, then tells the page through the "archivai:run-finished"
// window event (see UnityGame.jsx), and the room page opens this page. It shows the newest
// finished run of the logged-in user for the campaign, from GET /api/campaigns/:id/results/latest.
//
// roomId is passed in the router state by the room page so "Back to room" and "Play again" know
// where to go. If the page is opened without it (e.g. after a refresh), the button goes to the
// dashboard and "Play again" is not offered.
//
// THE SCORE - the server works out the score and the rank from the facts the game sent (see
// server/lib/scoring.js) and returns the breakdown as result.scoreDetails. A run that was finished
// right now is shown in two steps: first a "Calculating your results" screen (CalculatingScreen),
// then the top of the page (ResultsView) shows the trophy turning on the left (no frame, its name
// below), the points being added up in the middle (ScoreBoard: speed, wrong attempts, clues, notes
// one line at a time, then the big total) and, only when that is done, the rank letter on the right.
// Everything below that (the summary) stays as it was. The animation plays
// once per run in a browser tab session (sessionStorage); after that, and for runs finished earlier,
// the page shows the final numbers at once, with a Replay button. The Latest run box on a campaign
// card (CampaignQuestCard) opens this page with the router state { replay: true }, which plays the
// calculating screen and the animation again whatever the run's age. Visitors who prefer reduced motion
// get the final numbers at once. A run saved before the score existed has no scoreDetails and shows
// the page as it was, without the score card.

// How the newest attempt compares with the first one (from the server's "trend").
const TREND_TEXT = {
    improved: { tone: 'success', text: 'Better than your first attempt' },
    same: { tone: 'neutral', text: 'About the same as your first attempt' },
    lower: { tone: 'warning', text: 'Lower than your first attempt' },
}

// CampaignLockManager sends the lock's class name as its type. The page shows the kind of question
// the player answered, not the game's own names: the dial lock asks for a typed answer
// (Identification); the magic lock and the NPC conversation both ask to pick an answer (Multiple Choice).
const LOCK_TYPE_LABELS = {
    DialogueQAInteractable: 'Multiple Choice',
    ItemLockInteractable: 'Item lock',
    MagicLock: 'Multiple Choice',
    DialLockInteractable: 'Identification',
}

// complete: every recorded lock solved. incomplete: a lock (or checkpoint) was left.
// unknown: the game sent no lock data, so nothing is claimed either way.
function outcomeOf(result) {
    const locks = result.locks || []
    if (locks.length > 0) return locks.every((l) => l.isSolved) ? 'complete' : 'incomplete'
    if (result.checkpointsTotal != null && result.checkpointsReached != null && result.checkpointsReached < result.checkpointsTotal) return 'incomplete'
    return 'unknown'
}

const HEADLINES = {
    complete: { title: 'Campaign complete', text: 'You solved every lock.' },
    incomplete: { title: 'Run finished', text: "Some locks were not solved. You can play again to improve your result." },
    unknown: { title: 'Run complete', text: 'Here is how your run went.' },
}

// The calculating screen is shown for at least this long for a run that was just finished, so it can
// be seen even when the server answers at once.
// The short name shown under the rank emblem.
const RANK_TITLES = { S: 'Star', A: 'Gold', B: 'Silver', C: 'Bronze', D: 'Beginner' }

// The ranks from the lowest to the highest. The rank ladder under the emblem lights up along it.
const RANK_LADDER = ['D', 'C', 'B', 'A', 'S']

// The rank limits (share of the highest possible score), highest first. The server sends the ones it
// used with every new run (scoreDetails.rankTiers); these are the same values for runs saved before
// that. Keep them equal to SCORING.rankTiers in server/lib/scoring.js.
const DEFAULT_RANK_TIERS = [
    { rank: 'S', minPercent: 90 },
    { rank: 'A', minPercent: 75 },
    { rank: 'B', minPercent: 60 },
    { rank: 'C', minPercent: 45 },
    { rank: 'D', minPercent: 0 },
]

// The rank a running total has reached so far (used while the points are being added up).
const rankAtTotal = (total, maxScore, tiers) => {
    const percent = maxScore > 0 ? (total / maxScore) * 100 : 0
    return (tiers.find((t) => percent >= t.minPercent) || tiers[tiers.length - 1]).rank
}

// How long the calculating screen is held for a run that was just finished (long enough for every
// step below to be seen), and how long each step stays.
const CALC_MIN_MS = 4600
const CALC_STEP_MS = 900

// The speed of the score animation: when the first line comes in, the gap between lines, how long the
// running total takes to count to its new value, and the wait after the last line before the rank is shown.
const SCORE_FIRST_MS = 700
const SCORE_LINE_MS = 1600
const SCORE_COUNT_MS = 1200
const SCORE_SETTLE_MS = 1400

// A run counts as "just finished" for this long after it was completed.
const FRESH_MS = 3 * 60 * 1000

const CALC_STEPS = [
    { label: 'Receiving your run from the game', icon: Flag },
    { label: 'Counting your time', icon: Clock },
    { label: 'Checking your wrong attempts', icon: XCircle },
    { label: 'Counting clues and notes', icon: Lightbulb },
    { label: 'Working out your rank', icon: Trophy },
]

const isFresh = (result) => {
    const finished = new Date(result.completedAt).getTime()
    return Number.isFinite(finished) && Date.now() - finished < FRESH_MS
}

// Remembers (per browser tab session) which runs already played their animation.
const animatedKey = (id) => `archivai.results.animated.${id}`
const hasAnimated = (id) => {
    try { return sessionStorage.getItem(animatedKey(id)) === '1' } catch { return false }
}
const markAnimated = (id) => {
    try { sessionStorage.setItem(animatedKey(id), '1') } catch { /* the animation may then play again, which is harmless */ }
}

const prefersReducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// A number that moves from where it is now to target (up or down) whenever target changes. Used for the
// running total, which grows each time a line of points is added. With instant it is the target at once.
function useCountTo(target, instant, duration = 700) {
    const [value, setValue] = useState(instant ? target : 0)
    const valueRef = useRef(value)
    valueRef.current = value
    useEffect(() => {
        if (instant) {
            setValue(target)
            return undefined
        }
        const from = valueRef.current
        if (from === target) return undefined
        let frame = 0
        let start = null
        const tick = (now) => {
            if (start === null) start = now
            const t = Math.min(1, (now - start) / duration)
            setValue(Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3))))
            if (t < 1) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [target, instant, duration])
    return value
}

// A number that counts up from 0 to target while active. With instant it is the target at once.
function useCountUp(target, active, instant, duration = 800) {
    const [value, setValue] = useState(instant ? target : 0)
    useEffect(() => {
        if (instant) {
            setValue(target)
            return undefined
        }
        if (!active) {
            setValue(0)
            return undefined
        }
        let frame = 0
        let start = null
        const tick = (now) => {
            if (start === null) start = now
            const t = Math.min(1, (now - start) / duration)
            setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
            if (t < 1) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [target, active, instant, duration])
    return value
}

// Shown while the run is being fetched from the website (and for a moment longer when the run was
// just finished), so the player sees that the results are being worked out.
export function CalculatingScreen() {
    const [index, setIndex] = useState(0)
    useEffect(() => {
        const timer = setInterval(() => setIndex((i) => Math.min(i + 1, CALC_STEPS.length - 1)), CALC_STEP_MS)
        return () => clearInterval(timer)
    }, [])
    const percent = Math.round(((index + 1) / CALC_STEPS.length) * 100)

    return (
        <div className="page page--narrow">
            <Card className="calc-card">
                <div className="calc-sparks" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>

                <div className="calc-stage" aria-hidden="true">
                    <span className="calc-glow" />
                    <span className="calc-ring calc-ring--track" />
                    <span className="calc-ring calc-ring--outer" />
                    <span className="calc-ring calc-ring--inner" />
                    <div className="calc-sats">
                        {CALC_STEPS.map((step, i) => {
                            const Icon = step.icon
                            return (
                                <span key={step.label} className="calc-sat" style={{ '--angle': `${i * 72}deg` }}>
                                    <span className="calc-sat__icon" data-done={i < index} data-current={i === index}>
                                        <Icon size={16} />
                                    </span>
                                </span>
                            )
                        })}
                    </div>
                    <span className="calc-core"><Trophy size={34} /></span>
                </div>

                <div role="status" aria-live="polite" className="calc-card__text">
                    <h1 className="calc-card__title">Calculating your results<span className="calc-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></h1>
                    <p className="calc-card__step" key={index}>{CALC_STEPS[index].label}</p>
                </div>

                <div className="calc-progress" role="progressbar" aria-label="Calculating" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                    <span className="calc-progress__fill" style={{ width: `${percent}%` }} />
                </div>

                <ol className="calc-steps" aria-hidden="true">
                    {CALC_STEPS.map((step, i) => (
                        <li key={step.label} data-done={i < index} data-current={i === index}>
                            <span className="calc-steps__mark">{i < index ? <Check size={12} strokeWidth={3} /> : null}</span>
                            {step.label}
                        </li>
                    ))}
                </ol>
            </Card>
        </div>
    )
}

// The lines of the score board, from the breakdown the server saved. points is signed (wrong attempts
// are negative). hint is the short fact next to the label. A clue or note line is left out when the
// Scene has none of them. Lock types are shown by the kind of question (see LOCK_TYPE_LABELS), so
// two types with the same label are added together.
function buildScoreRows(details) {
    const rows = [{
        key: 'time',
        tone: 'info',
        label: 'Speed',
        hint: formatDuration(details.time.seconds),
        points: details.time.points,
    }]

    const wrongByLabel = new Map()
    for (const item of details.penalty.items) {
        const label = LOCK_TYPE_LABELS[item.type] || 'Lock'
        wrongByLabel.set(label, (wrongByLabel.get(label) || 0) + item.wrongAttempts)
    }
    rows.push({
        key: 'wrong',
        tone: 'danger',
        label: 'Wrong attempts',
        hint: wrongByLabel.size === 0 ? 'none' : [...wrongByLabel.entries()].map(([label, count]) => `${count} ${label}`).join(', '),
        points: -details.penalty.applied,
    })

    if (details.clues.total > 0) {
        rows.push({
            key: 'clues',
            tone: 'gold',
            label: 'Clues',
            hint: `${details.clues.found} of ${details.clues.total}`,
            points: details.clues.points,
        })
    }
    if (details.notes.total > 0) {
        rows.push({
            key: 'notes',
            tone: 'primary',
            label: 'Notes',
            hint: `${details.notes.found} of ${details.notes.total}`,
            points: details.notes.points,
        })
    }
    return rows
}

function ScoreLine({ row, visible, instant }) {
    const value = useCountUp(Math.abs(row.points), visible, instant, 1100)
    const sign = row.points > 0 ? '+' : row.points < 0 ? '\u2212' : ''
    return (
        <li className="score-line" data-tone={row.tone} data-visible={visible}>
            <span className="score-line__label">
                {row.label} <span className="score-line__hint">{row.hint}</span>
            </span>
            <span className="score-line__points">{visible ? `${sign}${value}` : '0'} pts</span>
        </li>
    )
}

// The middle of the top of the page. While running it adds the lines up one at a time (step counts
// how many lines have started; step N + 1 means every line is in and the total has settled, N + 2
// means finished and the rank on the right is revealed). The big total starts at 0 and grows by each
// line as it arrives. Skip jumps to the end. When not running it just shows the final numbers.
function ScoreBoard({ details, running, onFinish, onReplay, onTotal }) {
    const rows = useMemo(() => buildScoreRows(details), [details])
    const lineCount = rows.length
    const reduced = useMemo(prefersReducedMotion, [])
    const [skipped, setSkipped] = useState(false)
    const [step, setStep] = useState(running ? 0 : lineCount + 2)
    const finishRef = useRef(onFinish)
    finishRef.current = onFinish

    const instant = !running || reduced || skipped

    useEffect(() => {
        if (!running) return undefined
        if (reduced || skipped) {
            setStep(lineCount + 2)
            finishRef.current?.()
            return undefined
        }
        const timers = rows.map((_, i) => setTimeout(() => setStep(i + 1), SCORE_FIRST_MS + i * SCORE_LINE_MS))
        timers.push(setTimeout(() => setStep(lineCount + 1), SCORE_FIRST_MS + (lineCount - 1) * SCORE_LINE_MS + SCORE_COUNT_MS))
        timers.push(setTimeout(() => {
            setStep(lineCount + 2)
            finishRef.current?.()
        }, SCORE_FIRST_MS + (lineCount - 1) * SCORE_LINE_MS + SCORE_COUNT_MS + SCORE_SETTLE_MS))
        return () => timers.forEach(clearTimeout)
    }, [running, reduced, skipped, rows, lineCount])

    // The total after each step: nothing yet at step 0, then the points of the lines shown so far.
    // Once every line is in it is the saved score itself (so rounding can never leave it off by one).
    let runningTotal = 0
    for (let i = 0; i < Math.min(step, lineCount); i += 1) runningTotal += rows[i].points
    const totalTarget = step >= lineCount ? details.score : Math.max(0, runningTotal)
    const total = useCountTo(totalTarget, instant, SCORE_COUNT_MS)
    const fill = details.maxScore > 0 ? Math.min(100, (total / details.maxScore) * 100) : 0
    const settled = step >= lineCount + 1
    const finished = step >= lineCount + 2

    // The page above reads the running total to let the rank climb with it.
    useEffect(() => {
        onTotal?.(total)
    }, [total, onTotal])

    return (
        <div className="score-board">
            <ul className="score-lines" aria-label="Points added">
                {rows.map((row, i) => (
                    <ScoreLine key={row.key} row={row} visible={step >= i + 1} instant={instant} />
                ))}
            </ul>

            <div className="score-total" data-settled={settled}>
                <p className="score-total__number">{total}<span className="score-total__unit"> pts</span></p>
                <div className="score-total__bar" role="progressbar" aria-label="Score out of the highest possible" aria-valuemin={0} aria-valuemax={details.maxScore} aria-valuenow={total}>
                    <div className="score-total__fill" style={{ width: `${fill}%` }} />
                </div>
                <p className="score-total__max">of {details.maxScore} possible</p>
            </div>

            <div className="score-board__tools">
                <HelpTip
                    label="How the score works"
                    text={`Up to ${details.time.max} points for speed (full points at ${formatDuration(details.time.fast)} or faster, none at ${formatDuration(details.time.slow)} or slower), minus points for wrong attempts on Identification and Multiple Choice locks, plus up to ${details.clues.max} for clues and up to ${details.notes.max} for notes found. Skipping a lock is fine. The rank comes from the share of the highest possible score.`}
                />
                {running && !finished && <Button variant="ghost" size="sm" onClick={() => setSkipped(true)}>Skip</Button>}
                {!running && <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onReplay}>Replay</Button>}
            </div>

            {finished && (
                <p className="sr-only" role="status">
                    Score {details.score} of {details.maxScore}. Rank {details.rank}.
                </p>
            )}
        </div>
    )
}

// The content of the results page for one result. RunResults (below) loads the logged-in user's real
// result and passes it in; the admin's "Preview results page" (pages/admin/AdminTrophyPreview.jsx)
// passes in a sample result, so the admin sees exactly what a student sees. `trophy` is the Scene's
// trophy from the admin (or null). `attempts` is the student's history for the campaign (from
// GET /api/campaigns/:id/results/history), shown as "Previous attempts" when there is more than one run. `preview` hides the back and play-again buttons.
export function ResultsView({ result, trophy = null, attempts = null, showXp, backButton, roomPath, onBack, onRetry, preview = false, animate = false, onAnimationDone, onViewAttempt }) {
    const details = result.scoreDetails || null
    // running: the score board is adding the points up and the rank is still hidden.
    const [running, setRunning] = useState(Boolean(animate && details))
    const [replayKey, setReplayKey] = useState(0)
    // Which section of the results is shown: the locks or the clues and notes.
    const [view, setView] = useState('locks')
    // The running total of the score board; the rank emblem climbs the tiers as it grows.
    const [liveTotal, setLiveTotal] = useState(0)
    const revealed = !running
    const handleFinish = () => {
        setRunning(false)
        onAnimationDone?.()
    }
    const handleReplay = () => {
        setReplayKey((k) => k + 1)
        setLiveTotal(0)
        setRunning(true)
    }
    // A row of the Previous attempts table: another run opens through the page above (onViewAttempt),
    // the run already shown just plays its animation again from the top.
    const handlePickAttempt = (attempt, isLatest) => {
        if (attempt.id === result.id) {
            handleReplay()
            window.scrollTo({ top: 0, behavior: 'smooth' })
            return
        }
        onViewAttempt?.(attempt, isLatest)
    }

    // The rank shown on the emblem: while the points are added up it is the tier the running total has
    // reached so far (from the lowest upwards); once the run is revealed it is the run's real rank.
    const tiers = details?.rankTiers || DEFAULT_RANK_TIERS
    const climbingRank = details ? rankAtTotal(liveTotal, details.maxScore, tiers) : null
    const shownRank = revealed ? (result.rank || null) : climbingRank

    const outcome = outcomeOf(result)
    const headline = HEADLINES[outcome]
    const locks = [...(result.locks || [])].sort((a, b) => a.order - b.order)
    const solved = locks.filter((l) => l.isSolved).length
    // Every clue and note of the journal in reel order, with whether it was picked up (sent by the game with the
    // run; a run from an older build has none and the section then says so). A standalone note is a Note.
    const journal = Array.isArray(details?.journal) ? details.journal : []
    const journalFound = journal.filter((item) => item.found).length

    const lockSection = (
        <section aria-label="Locks Solved">
            {locks.length > 0 && <p className="text-sm text-muted" style={{ marginBottom: 12 }}>{solved} of {plural(locks.length, 'lock')} solved</p>}

            {locks.length === 0 ? (
                <EmptyState plain icon={Flag} title="No lock results recorded">
                    The game didn't send a lock-by-lock breakdown for this run.
                </EmptyState>
            ) : (
                <Card flush>
                    <table className="data-table">
                        <caption className="sr-only">Result for each lock in this run</caption>
                        <thead>
                            <tr>
                                <th scope="col">Lock</th>
                                <th scope="col">Type</th>
                                <th scope="col">Status</th>
                                <th scope="col">Wrong attempts</th>
                            </tr>
                        </thead>
                        <tbody>
                            {locks.map((lock) => (
                                <tr key={lock.id || lock.order}>
                                    <td data-primary className="font-semibold">Lock {lock.order}</td>
                                    <td data-label="Type">{LOCK_TYPE_LABELS[lock.type] || lock.type || 'Lock'}</td>
                                    <td data-label="Status">
                                        {lock.isSolved
                                            ? <Badge tone="success" icon={CheckCircle2}>Solved</Badge>
                                            : <Badge tone="neutral" icon={XCircle}>Not solved</Badge>}
                                    </td>
                                    <td data-label="Wrong attempts">{lock.attempts}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}
        </section>
    )

    const journalSection = (
        <section aria-label="Clues and notes">
            {journal.length > 0 && <p className="text-sm text-muted" style={{ marginBottom: 12 }}>{journalFound} of {journal.length} found</p>}

            {journal.length === 0 ? (
                <EmptyState plain icon={Lightbulb} title="No clue and note list for this run">
                    The game build that saved this run did not send it. Finish a new run to see which clues and notes you picked up.
                </EmptyState>
            ) : (
                <Card flush>
                    <table className="data-table">
                        <caption className="sr-only">Every clue and note of the journal, in order, and whether you picked it up</caption>
                        <thead>
                            <tr>
                                <th scope="col">Entry</th>
                                <th scope="col">Item name</th>
                                <th scope="col">Type</th>
                                <th scope="col">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {journal.map((item) => (
                                <tr key={item.id || item.order}>
                                    <td data-primary className="font-semibold">Clue {item.order}</td>
                                    <td data-label="Item name">{item.name || item.id}</td>
                                    <td data-label="Type">
                                        <span className="row" style={{ '--gap': '6px' }}>
                                            {item.type === 'Clue' ? <Lightbulb size={16} aria-hidden="true" /> : <StickyNote size={16} aria-hidden="true" />}
                                            {item.type === 'Clue' ? 'Clue' : 'Note'}
                                        </span>
                                    </td>
                                    <td data-label="Status">
                                        {item.found
                                            ? <Badge tone="success" icon={CheckCircle2}>Found</Badge>
                                            : <Badge tone="neutral" icon={XCircle}>Not found</Badge>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}
        </section>
    )

    return (
        <div className="page page--narrow">
            {!preview && <div style={{ marginBottom: 16 }}>{backButton}</div>}

            <p className="sr-only" role="status">
                {headline.title} {revealed && result.rank ? `Rank ${result.rank}.` : ''}
            </p>

            <section className="results-top" style={sceneStyle(result.scene)} data-outcome={outcome}>
                {outcome === 'complete' && revealed && <Confetti key={replayKey} />}

                <div className="results-top__trophy">
                    {trophy ? (
                        <TrophyViewer key={trophy.src} src={`${API_URL}${trophy.src}`} height={260} label={`${trophy.label} trophy`} bare />
                    ) : (
                        <div className="results-top__art" aria-hidden="true"><ChestArt /></div>
                    )}
                    <p className="results-top__name display">{trophy ? trophy.label : getSceneMeta(result.scene).label}</p>
                    {trophy && revealed && result.rank && (
                        <p className="text-xs text-muted">Earned in the {getSceneMeta(result.scene).label} with Rank {result.rank}</p>
                    )}
                </div>

                {details ? (
                    <ScoreBoard key={replayKey} details={details} running={running} onFinish={handleFinish} onReplay={handleReplay} onTotal={setLiveTotal} />
                ) : (
                    <div className="score-board">
                        <p className="text-sm text-muted">No score was recorded for this run. It was finished before points were added.</p>
                    </div>
                )}

                <div className="rank-board">
                    <p className="rank-board__label">Rank</p>
                    <div
                        key={`${shownRank || 'none'}-${revealed}`}
                        className="rank-emblem"
                        data-rank={shownRank || 'none'}
                        data-pending={!revealed && !shownRank}
                        data-climb={!revealed}
                        data-reveal={revealed && details ? 'true' : undefined}
                        role="img"
                        aria-label={revealed ? (result.rank ? `Rank ${result.rank}` : 'No rank recorded') : 'Calculating rank'}
                    >
                        <span className="rank-emblem__ring" aria-hidden="true" />
                        <span className="rank-emblem__letter" aria-hidden="true">{shownRank || (revealed ? '\u2014' : '?')}</span>
                    </div>
                    <p className="rank-board__title">{shownRank ? RANK_TITLES[shownRank] : '\u00a0'}</p>
                    {details && (
                        <ol className="rank-ladder" aria-hidden="true">
                            {RANK_LADDER.map((rank, i) => (
                                <li key={rank} data-rank={rank} data-reached={shownRank ? i <= RANK_LADDER.indexOf(shownRank) : false}>{rank}</li>
                            ))}
                        </ol>
                    )}
                </div>
            </section>

            <div className="results-after" data-ready={revealed}>
                <div className="results-summary-head section">
                    <div className="row" style={{ "--gap": "8px" }}>
                        <SceneBadge scene={result.scene} />
                        {result.completedAt && <span className="text-xs text-muted">{formatDate(result.completedAt)}</span>}
                    </div>
                    <h1>{headline.title}</h1>
                    <p className="results-hero__campaign display">{result.campaignTitle}</p>
                    <p className="text-sm text-muted">{headline.text}</p>
                </div>

                <div className="stat-grid section" style={{ "--cols": showXp ? 4 : 3 }}>
                    <Stat icon={Clock} tone="info" label="Completion time" value={formatDuration(result.totalTime)} />
                    <Stat icon={XCircle} tone="warning" label="Wrong attempts" value={result.mistakes ?? 'Not recorded'} />
                    <Stat
                        icon={Flag}
                        tone="success"
                        label="Checkpoints"
                        value={result.checkpointsReached == null || result.checkpointsTotal == null ? 'Not recorded' : `${result.checkpointsReached}/${result.checkpointsTotal}`}
                    />
                    {showXp && (
                        <div className="stat">
                            <span className="stat__icon" aria-hidden="true" style={{ "--stat-fg": "var(--color-xp)", "--stat-soft": "var(--color-xp-track)" }}>
                                <Sparkles size={22} />
                            </span>
                            <div className="grow">
                                <p className="stat__value">{xpForRun(result)} XP</p>
                                <p className="stat__label row" style={{ "--gap": "4px" }}>
                                    XP <Badge tone="xp">Preview</Badge>
                                    <HelpTip
                                        label="How XP works"
                                        text={`Preview rules: ${SCORING.campaignComplete} XP for finishing plus a rank bonus. Each campaign counts once toward your level, using your latest run - replays don't add extra XP.`}
                                    />
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="section">
                    {details ? (
                        <Tabs
                            label="Results section"
                            value={view}
                            onChange={setView}
                            tabs={[
                                { id: 'locks', label: 'Locks Solved', icon: Flag },
                                { id: 'journal', label: 'Clues and notes', icon: Lightbulb },
                            ]}
                        >
                            {view === 'locks' ? lockSection : journalSection}
                        </Tabs>
                    ) : lockSection}
                </div>

                {attempts && attempts.attempts.length > 1 && (
                    <section className="section" aria-labelledby="attempts-heading">
                        <div className="section__head">
                            <div>
                                <h2 id="attempts-heading" className="section__title">Previous attempts</h2>
                                <p className="text-sm text-muted">
                                    Best rank: <strong>{attempts.bestRank || 'None'}</strong> · Best time: <strong>{attempts.bestTime == null ? 'None' : formatDuration(attempts.bestTime)}</strong>
                                </p>
                                {!preview && <p className="text-xs text-muted">Select an attempt to view its results.</p>}
                            </div>
                            {TREND_TEXT[attempts.trend] && <Badge tone={TREND_TEXT[attempts.trend].tone}>{TREND_TEXT[attempts.trend].text}</Badge>}
                        </div>
                        <Card flush>
                            <table className="data-table">
                                <caption className="sr-only">All your finished attempts of this campaign, newest first. Select one to view its results.</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">Attempt</th>
                                        <th scope="col">Finished</th>
                                        <th scope="col">Time</th>
                                        <th scope="col">Rank</th>
                                        <th scope="col">Wrong attempts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {attempts.attempts.map((a, index) => (
                                        <tr
                                            key={a.id}
                                            className={onViewAttempt ? 'attempt-row' : undefined}
                                            data-current={a.id === result.id}
                                            onClick={onViewAttempt ? () => handlePickAttempt(a, index === 0) : undefined}
                                        >
                                            <td data-primary className="font-semibold">
                                                {onViewAttempt ? (
                                                    <button
                                                        type="button"
                                                        className="attempt-row__button"
                                                        aria-current={a.id === result.id ? 'true' : undefined}
                                                        aria-label={`View the results of attempt ${a.number}${a.rank ? `, Rank ${a.rank}` : ''}`}
                                                    >
                                                        #{a.number}
                                                    </button>
                                                ) : <>#{a.number}</>}
                                                {index === 0 && <> <Badge tone="primary">Latest</Badge></>}
                                                {a.id === result.id && <> <Badge tone="accent">Viewing</Badge></>}
                                            </td>
                                            <td data-label="Finished">{formatDate(a.completedAt)}</td>
                                            <td data-label="Time">{formatDuration(a.totalTime)}</td>
                                            <td data-label="Rank">{a.rank ? <Badge tone="accent">Rank {a.rank}</Badge> : <span className="text-sm text-muted">No rank</span>}</td>
                                            <td data-label="Wrong attempts">{a.mistakes ?? 'Not recorded'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    </section>
                )}

                {!preview && (
                    <div className="results-actions section">
                        {roomPath && (
                            <Button variant="accent" size="lg" icon={RotateCcw} onClick={onRetry}>
                                Play again
                            </Button>
                        )}
                        <Button variant="secondary" size="lg" icon={ArrowLeft} onClick={onBack}>
                            {roomPath ? 'Back to room' : 'Back to dashboard'}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

function RunResults() {
    const environments = useEnvironments()
    const { campaignId } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const [notFound, setNotFound] = useState(false)
    const [reloadKey, setReloadKey] = useState(0)
    const [trophy, setTrophy] = useState(null)
    const [attempts, setAttempts] = useState(null)
    // calcDone: the calculating screen may be replaced by the results. animate: this run plays the
    // score animation (it was just finished, has a score, and has not played it yet in this tab).
    const [calcDone, setCalcDone] = useState(false)
    const [animate, setAnimate] = useState(false)
    const mountedAt = useRef(Date.now())

    // ?attempt=<run id> opens one earlier run picked from the Previous attempts table; without it the
    // newest run opens.
    const attemptParam = /^\d+$/.test(searchParams.get('attempt') || '') ? searchParams.get('attempt') : null

    const roomId = location.state?.roomId
    const replayRequested = Boolean(location.state?.replay)
    const role = getRole()

    useEffect(() => {
        let cancelled = false
        // A new run is loading: the calculating screen shows again until it is ready.
        setResult(null)
        setNotFound(false)
        setCalcDone(false)
        setAnimate(false)
        mountedAt.current = Date.now()
        const fetchResult = async () => {
            try {
                const { ok, status, data } = await api(`/campaigns/${campaignId}/results/${attemptParam || 'latest'}`)
                if (cancelled) return
                if (status === 404) {
                    setNotFound(true)
                    return
                }
                if (!ok) throw new Error(errorMessage(data, 'Could not load the results'))
                setError(null)
                setResult(data)
            } catch (err) {
                if (!cancelled) setError(err.message === 'Failed to fetch' ? "Couldn't reach the server. Check your connection." : err.message)
            }
        }
        fetchResult()
        return () => { cancelled = true }
    }, [campaignId, attemptParam, reloadKey])

    // Decides, once the run has loaded, whether to play the animation, and holds the calculating
    // screen long enough to be seen when it does.
    useEffect(() => {
        if (!result) return undefined
        const play = Boolean(result.scoreDetails) && (replayRequested || (isFresh(result) && !hasAnimated(result.id)))
        setAnimate(play)
        const wait = play ? Math.max(0, CALC_MIN_MS - (Date.now() - mountedAt.current)) : 0
        const timer = setTimeout(() => setCalcDone(true), wait)
        return () => clearTimeout(timer)
    }, [result, replayRequested])

    // The trophy the admin set for this run's Scene (none if there is no trophy or it can't be loaded).
    const resultScene = result?.scene
    useEffect(() => {
        if (!resultScene) return
        let cancelled = false
        const wanted = String(resultScene).toLowerCase().trim()
        api('/scene-trophies')
            .then(({ ok, data }) => {
                if (cancelled || !ok || !Array.isArray(data)) return
                const key = environments.find((e) => e.key === wanted || e.label.toLowerCase() === wanted)?.key || wanted
                setTrophy(data.find((t) => t.sceneKey === key) || null)
            })
            .catch(() => {})
        return () => { cancelled = true }
    }, [resultScene, environments])

    // The student's earlier finished runs of this campaign (none shown if it can't be loaded).
    useEffect(() => {
        if (!result) return
        let cancelled = false
        api(`/campaigns/${campaignId}/results/history`)
            .then(({ ok, data }) => {
                if (!cancelled && ok && data && Array.isArray(data.attempts)) setAttempts(data)
            })
            .catch(() => {})
        return () => { cancelled = true }
    }, [campaignId, result])

    const roomPath = roomId ? (role === 'STUDENT' ? `/student/room/${roomId}` : `/teacher/room/${roomId}`) : null
    const homePath = role === 'STUDENT' ? '/student/dashboard' : role === 'ADMIN' ? '/admin/dashboard' : '/teacher/dashboard'

    const handleBack = () => navigate(roomPath || homePath)
    // A row of the Previous attempts table. The newest run goes back to the plain results address.
    const handleViewAttempt = (attempt, isLatest) => {
        window.scrollTo({ top: 0 })
        navigate(isLatest ? `/results/${campaignId}` : `/results/${campaignId}?attempt=${attempt.id}`, { state: { roomId, replay: true } })
    }
    // The room page starts the same Play flow (active campaign PATCH, then the game).
    const handleRetry = () => navigate(roomPath, { state: { playCampaignId: Number(campaignId) } })

    const backButton = (
        <Button variant="ghost" icon={ArrowLeft} onClick={handleBack}>
            {roomPath ? 'Back to room' : 'Back to dashboard'}
        </Button>
    )

    if (error) {
        return (
            <div className="page page--narrow">
                {backButton}
                <Alert tone="danger" title="We couldn't load your results" action={<Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>Try again</Button>}>
                    {error}
                </Alert>
            </div>
        )
    }

    if (notFound) {
        return (
            <div className="page page--narrow">
                {backButton}
                <EmptyState icon={Flag} title="No finished run yet">
                    Finish this campaign once and your time, rank and lock results will appear here.
                </EmptyState>
            </div>
        )
    }

    if (!result || !calcDone) return <CalculatingScreen />

    return (
        <ResultsView
            result={result}
            trophy={trophy}
            attempts={attempts}
            onViewAttempt={handleViewAttempt}
            showXp={role === 'STUDENT'}
            backButton={backButton}
            roomPath={roomPath}
            onBack={handleBack}
            onRetry={handleRetry}
            animate={animate}
            onAnimationDone={() => markAnimated(result.id)}
        />
    )
}

export default RunResults
