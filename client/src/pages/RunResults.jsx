import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowLeft, CheckCircle2, Clock, Flag, RotateCcw, Sparkles, XCircle } from 'lucide-react'
import { ChestArt } from '../components/Illustrations'
import { SceneBadge } from '../components/SceneIcon'
import { Alert, Badge, Button, Card, Confetti, EmptyState, HelpTip, LoadingState, RankMedal, Stat } from '../components/ui'
import { api, errorMessage } from '../lib/api'
import { getRole } from '../lib/session'
import { formatDate, formatDuration, plural } from '../lib/format'
import { SCORING, xpForRun } from '../lib/gamification'
import { sceneStyle } from '../scenes'

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

// CampaignLockManager sends the lock's class name as its type.
const LOCK_TYPE_LABELS = {
    DialogueQAInteractable: 'Conversation lock',
    ItemLockInteractable: 'Item lock',
    MagicLock: 'Magic lock',
    DialLockInteractable: 'Dial lock',
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

function RunResults() {
    const { campaignId } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const [notFound, setNotFound] = useState(false)
    const [reloadKey, setReloadKey] = useState(0)

    const roomId = location.state?.roomId
    const role = getRole()

    useEffect(() => {
        let cancelled = false
        const fetchResult = async () => {
            try {
                const { ok, status, data } = await api(`/campaigns/${campaignId}/results/latest`)
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
    }, [campaignId, reloadKey])

    const roomPath = roomId ? (role === 'STUDENT' ? `/student/room/${roomId}` : `/teacher/room/${roomId}`) : null
    const homePath = role === 'STUDENT' ? '/student/dashboard' : role === 'ADMIN' ? '/admin/dashboard' : '/teacher/dashboard'

    const handleBack = () => navigate(roomPath || homePath)
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

    if (!result) {
        return (
            <div className="page page--narrow">
                <LoadingState label="Loading your results..." />
            </div>
        )
    }

    const outcome = outcomeOf(result)
    const headline = HEADLINES[outcome]
    const locks = [...(result.locks || [])].sort((a, b) => a.order - b.order)
    const solved = locks.filter((l) => l.isSolved).length
    const showXp = role === 'STUDENT'

    return (
        <div className="page page--narrow">
            <div style={{ marginBottom: 16 }}>{backButton}</div>

            <p className="sr-only" role="status">
                {headline.title} {result.rank ? `Rank ${result.rank}.` : ''}
            </p>

            <Card className="results-hero" style={sceneStyle(result.scene)} data-outcome={outcome}>
                {outcome === 'complete' && <Confetti />}
                <div className="results-hero__art" aria-hidden="true">
                    <ChestArt />
                </div>
                <div className="results-hero__text">
                    <div className="row" style={{ "--gap": "8px" }}>
                        <SceneBadge scene={result.scene} />
                        {result.completedAt && <span className="text-xs text-muted">{formatDate(result.completedAt)}</span>}
                    </div>
                    <h1>{headline.title}</h1>
                    <p className="results-hero__campaign display">{result.campaignTitle}</p>
                    <p className="text-sm text-muted">{headline.text}</p>
                </div>
                <div className="results-hero__rank">
                    <RankMedal rank={result.rank} size={96} />
                    <p className="text-sm font-semibold">{result.rank ? `Rank ${result.rank}` : 'No rank recorded'}</p>
                    <p className="text-xs text-muted">From your time and mistakes</p>
                </div>
            </Card>

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

            <section className="section" aria-labelledby="locks-heading">
                <div className="section__head">
                    <h2 id="locks-heading" className="section__title">Lock by lock</h2>
                    {locks.length > 0 && <span className="text-sm text-muted">{solved} of {plural(locks.length, 'lock')} solved</span>}
                </div>

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

            <div className="results-actions section">
                {roomPath && (
                    <Button variant="accent" size="lg" icon={RotateCcw} onClick={handleRetry}>
                        Play again
                    </Button>
                )}
                <Button variant="secondary" size="lg" icon={ArrowLeft} onClick={handleBack}>
                    {roomPath ? 'Back to room' : 'Back to dashboard'}
                </Button>
            </div>
        </div>
    )
}

export default RunResults
