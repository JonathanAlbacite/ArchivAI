import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, Fragment } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Clock, Flag, RefreshCw, Sparkles, Users } from 'lucide-react'
import { SceneBadge } from '../../components/SceneIcon'
import { Alert, Avatar, Badge, Breadcrumbs, Button, Card, EmptyState, IconButton, LoadingState, PageHeader, StatusChip, Stat } from '../../components/ui'
import { api, errorMessage } from '../../lib/api'
import { clearSession } from '../../lib/session'
import { formatDate, formatDuration, plural } from '../../lib/format'
import { useEnvironments } from '../../scenes'

// StudentProgressPage.jsx
//
// The Student Progress screen of a campaign (Figure 16 of the paper), opened from a campaign in the
// teacher's Room page. It shows how every student of the room is doing on that one campaign, from
// GET /api/campaigns/:id/student-progress (see server/routes/studentProgress.js):
//   - a class summary (finished, playing, not started, average completion),
//   - the locks the class got wrong most,
//   - each student's completion %, time, clues found, previous attempts, and best rank and time.
//
// COMPLETION % is the average of the locks solved and the checkpoints reached. For a student who is
// still playing, the locks, the checkpoints and the TIME come from the game's last checkpoint, so they
// only change when the student reaches a checkpoint (the game does not send anything between
// checkpoints). Clues found are only known while a student is playing; they are cleared when a run
// is finished. The page reloads itself every 30 seconds while it is open.

const REFRESH_MS = 30000

// Names for the lock classes the game sends (same names as the results page).
const LOCK_TYPE_LABELS = {
    DialogueQAInteractable: 'Conversation lock',
    ItemLockInteractable: 'Item lock',
    MagicLock: 'Magic lock',
    DialLockInteractable: 'Dial lock',
}

const TREND = {
    improved: { tone: 'success', text: 'Improved since the first attempt' },
    same: { tone: 'neutral', text: 'About the same as the first attempt' },
    lower: { tone: 'warning', text: 'Lower than the first attempt' },
}

// "just now", "5 min ago", "2 h ago", "3 days ago".
function timeAgo(value) {
    if (!value) return ''
    const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000)
    if (Number.isNaN(minutes)) return ''
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours} h ago`
    return `${Math.round(hours / 24)} days ago`
}

function CompletionBar({ percent }) {
    if (percent === null || percent === undefined) return <span className="text-sm text-muted">Not recorded</span>
    return (
        <div className="row row-nowrap" style={{ "--gap": "8px", minWidth: 130 }}>
            <div
                role="progressbar"
                aria-label="Completion"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--color-surface-muted)', overflow: 'hidden' }}
            >
                <div style={{ width: `${percent}%`, height: '100%', background: 'var(--color-primary)' }} />
            </div>
            <span className="text-sm font-semibold">{percent}%</span>
        </div>
    )
}

// What the completion % is made of, for the small line under the bar.
function completionDetail(current) {
    const parts = []
    if (current.locksTotal) parts.push(`${current.locksSolved}/${current.locksTotal} locks`)
    if (current.checkpointsTotal) parts.push(`${current.checkpointsReached}/${current.checkpointsTotal} checkpoints`)
    else if (current.checkpointsReached) parts.push(plural(current.checkpointsReached, 'checkpoint'))
    return parts.join(' · ')
}

const rankBadge = (rank) => (rank ? <Badge tone="accent">Rank {rank}</Badge> : <span className="text-sm text-muted">No rank</span>)

// The previous attempts of one student, shown under the student's row.
function AttemptsList({ student }) {
    const trend = TREND[student.trend]
    return (
        <div className="stack" style={{ padding: '4px 8px 12px' }}>
            <div className="row" style={{ "--gap": "8px" }}>
                <span className="text-sm">
                    Best rank: <strong>{student.bestRank || 'None yet'}</strong> · Best time: <strong>{student.bestTime == null ? 'None yet' : formatDuration(student.bestTime)}</strong>
                </span>
                {trend && <Badge tone={trend.tone}>{trend.text}</Badge>}
            </div>
            {student.attempts.length === 0 ? (
                <p className="text-sm text-muted">No finished attempts yet.</p>
            ) : (
                <table className="data-table">
                    <caption className="sr-only">Finished attempts of {student.name}, newest first</caption>
                    <thead>
                        <tr>
                            <th scope="col">Attempt</th>
                            <th scope="col">Finished</th>
                            <th scope="col">Time</th>
                            <th scope="col">Rank</th>
                            <th scope="col">Wrong attempts</th>
                            <th scope="col">Locks solved</th>
                        </tr>
                    </thead>
                    <tbody>
                        {student.attempts.map((a) => (
                            <tr key={a.id}>
                                <td data-primary className="font-semibold">#{a.number}</td>
                                <td data-label="Finished">{formatDate(a.completedAt)}</td>
                                <td data-label="Time">{formatDuration(a.totalTime)}</td>
                                <td data-label="Rank">{rankBadge(a.rank)}</td>
                                <td data-label="Wrong attempts">{a.mistakes ?? 'Not recorded'}</td>
                                <td data-label="Locks solved">{a.locksTotal ? `${a.locksSolved}/${a.locksTotal}` : 'Not recorded'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}

function StudentProgressPage() {
    useEnvironments()
    const { roomId, campaignId } = useParams()
    const navigate = useNavigate()
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const [reloadKey, setReloadKey] = useState(0)
    const [openId, setOpenId] = useState(null)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const { ok, status, data: body } = await api(`/campaigns/${campaignId}/student-progress`)
                if (cancelled) return
                if (status === 401) {
                    clearSession()
                    navigate('/')
                    return
                }
                if (!ok) {
                    setError(errorMessage(body, "Couldn't load the student progress."))
                    return
                }
                setError('')
                setData(body)
            } catch {
                if (!cancelled) setError("Couldn't reach the server. Check your connection.")
            }
        }
        load()
        const timer = setInterval(() => {
            if (document.visibilityState === 'visible') load()
        }, REFRESH_MS)
        return () => {
            cancelled = true
            clearInterval(timer)
        }
    }, [campaignId, reloadKey, navigate])

    const roomPath = `/teacher/room/${roomId}`
    const summary = data?.summary

    return (
        <div className="page">
            <PageHeader
                breadcrumbs={
                    <Breadcrumbs
                        items={[
                            { label: 'Rooms', to: '/teacher/dashboard' },
                            { label: data?.campaign.roomName || 'Room', to: roomPath },
                            { label: 'Student progress' },
                        ]}
                    />
                }
                eyebrow="Student progress"
                title={data?.campaign.title || 'Campaign'}
                description="Time, locks and checkpoints of students who are still playing come from their last checkpoint, so they change when a student reaches one. This page reloads every 30 seconds."
                actions={
                    <>
                        <Button variant="secondary" icon={RefreshCw} onClick={() => setReloadKey((k) => k + 1)}>
                            Refresh
                        </Button>
                        <Button variant="ghost" to={roomPath}>
                            Back to room
                        </Button>
                    </>
                }
            >
                {data?.campaign.scene && (
                    <div style={{ marginTop: 8 }}>
                        <SceneBadge scene={data.campaign.scene} />
                    </div>
                )}
            </PageHeader>

            {error && (
                <Alert tone="danger" title="Something didn't load" action={<Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>Try again</Button>}>
                    {error}
                </Alert>
            )}

            {!data && !error && <LoadingState label="Loading student progress..." />}

            {data && (
                <>
                    <div className="stat-grid" style={{ "--cols": 4 }}>
                        <Stat icon={CheckCircle2} tone="success" label="Finished" value={`${summary.finished} of ${summary.students}`} />
                        <Stat icon={Clock} tone="info" label="Still playing" value={summary.playing} />
                        <Stat icon={Flag} tone="warning" label="Not started" value={summary.notStarted} />
                        <Stat icon={Sparkles} tone="primary" label="Average completion" value={summary.averageCompletion == null ? '–' : `${summary.averageCompletion}%`} />
                    </div>

                    {data.hardestLocks.length > 0 && (
                        <section className="section" aria-labelledby="hardest-heading">
                            <div className="section__head">
                                <div>
                                    <h2 id="hardest-heading" className="section__title">Hardest locks</h2>
                                    <p className="text-sm text-muted">The locks the class got wrong most. A good place to re-teach.</p>
                                </div>
                            </div>
                            <Card flush>
                                <table className="data-table">
                                    <caption className="sr-only">Locks with the most wrong attempts</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">Lock</th>
                                            <th scope="col">Type</th>
                                            <th scope="col">Wrong attempts</th>
                                            <th scope="col">Students who got it wrong</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.hardestLocks.map((lock) => (
                                            <tr key={lock.id}>
                                                <td data-primary className="font-semibold">{lock.order ? `Lock ${lock.order}` : lock.id}</td>
                                                <td data-label="Type">{LOCK_TYPE_LABELS[lock.type] || lock.type || 'Lock'}</td>
                                                <td data-label="Wrong attempts">{lock.wrongAttempts}</td>
                                                <td data-label="Students who got it wrong">
                                                    {lock.studentsWithMistakes} of {lock.outOf}
                                                    {lock.missedPercent != null ? ` (${lock.missedPercent}%)` : ''}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </Card>
                        </section>
                    )}

                    <section className="section" aria-labelledby="students-heading">
                        <div className="section__head">
                            <h2 id="students-heading" className="section__title">Students</h2>
                            <span className="text-sm text-muted">{plural(data.students.length, 'student')}</span>
                        </div>

                        {data.students.length === 0 ? (
                            <EmptyState icon={Users} title="No students in this room yet">
                                Share the room code or add students, then their progress shows here.
                            </EmptyState>
                        ) : (
                            <Card flush>
                                <table className="data-table">
                                    <caption className="sr-only">Progress of each student on this campaign</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">Student</th>
                                            <th scope="col">Status</th>
                                            <th scope="col">Completion</th>
                                            <th scope="col">Time</th>
                                            <th scope="col">Clues found</th>
                                            <th scope="col">Attempts</th>
                                            <th scope="col"><span className="sr-only">Details</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.students.map((s) => {
                                            const open = openId === s.id
                                            return (
                                                <Fragment key={s.id}>
                                                    <tr>
                                                        <td data-primary>
                                                            <span className="row row-nowrap" style={{ "--gap": "10px" }}>
                                                                <Avatar name={s.name} size={32} />
                                                                <span>
                                                                    <span className="font-semibold">{s.name}</span>
                                                                    {s.lastPlayedAt && <span className="text-xs text-muted" style={{ display: 'block' }}>Last played {timeAgo(s.lastPlayedAt)}</span>}
                                                                </span>
                                                            </span>
                                                        </td>
                                                        <td data-label="Status"><StatusChip status={s.state} /></td>
                                                        <td data-label="Completion">
                                                            {s.current ? (
                                                                <>
                                                                    <CompletionBar percent={s.current.completionPercent} />
                                                                    <span className="text-xs text-muted">{completionDetail(s.current)}</span>
                                                                </>
                                                            ) : (
                                                                <span className="text-sm text-muted">0%</span>
                                                            )}
                                                        </td>
                                                        <td data-label="Time">
                                                            {!s.current ? (
                                                                <span className="text-sm text-muted">–</span>
                                                            ) : s.state === 'inProgress' ? (
                                                                s.current.runSeconds == null ? (
                                                                    <span className="text-sm text-muted">No checkpoint yet</span>
                                                                ) : (
                                                                    <>
                                                                        {formatDuration(s.current.runSeconds)}
                                                                        <span className="text-xs text-muted" style={{ display: 'block' }}>at last checkpoint · saved {timeAgo(s.current.savedAt)}</span>
                                                                    </>
                                                                )
                                                            ) : (
                                                                <>
                                                                    {formatDuration(s.current.runSeconds)}
                                                                    <span className="text-xs text-muted" style={{ display: 'block' }}>latest finished run</span>
                                                                </>
                                                            )}
                                                        </td>
                                                        <td data-label="Clues found">{s.current?.cluesFound == null ? <span className="text-sm text-muted">–</span> : s.current.cluesFound}</td>
                                                        <td data-label="Attempts">
                                                            {s.attemptCount === 0 ? (
                                                                <span className="text-sm text-muted">None finished</span>
                                                            ) : (
                                                                <span className="row" style={{ "--gap": "6px" }}>
                                                                    {plural(s.attemptCount, 'attempt')}
                                                                    {s.bestRank && <Badge tone="accent">Best {s.bestRank}</Badge>}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <IconButton
                                                                icon={open ? ChevronUp : ChevronDown}
                                                                size="sm"
                                                                label={`${open ? 'Hide' : 'Show'} attempts of ${s.name}`}
                                                                aria-expanded={open}
                                                                onClick={() => setOpenId(open ? null : s.id)}
                                                            />
                                                        </td>
                                                    </tr>
                                                    {open && (
                                                        <tr>
                                                            <td colSpan={7}>
                                                                <AttemptsList student={s} />
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </Card>
                        )}
                    </section>
                </>
            )}
        </div>
    )
}

export default StudentProgressPage
