import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { BookOpen, CheckCircle2, ChartNoAxesColumn, ChevronRight, Clock, DoorOpen, Eye, Flag, Paperclip, Play, Repeat, Sparkles, Users } from 'lucide-react'
import { SceneBadge } from '../../components/SceneIcon'
import AttachmentPreviewModal from '../../components/AttachmentPreviewModal'
import CampaignViewer from '../../components/teacher/CampaignViewer'
import { Alert, Avatar, Badge, Breadcrumbs, Button, Card, EmptyState, PageHeader, RankMedal, Skeleton, Stat, StatusChip } from '../../components/ui'
import { api, errorMessage } from '../../lib/api'
import { clearSession } from '../../lib/session'
import { formatDate, formatDuration, plural } from '../../lib/format'
import { sceneStyle, useEnvironments } from '../../scenes'

// TeacherCampaignPage.jsx
//
// The whole page for one campaign, opened by selecting its card on the teacher's Room page
// (/teacher/room/:roomId/campaign/:campaignId). It is the teacher's counterpart of the student's
// campaign page. It shows:
//   - what the campaign is (scene, status, description, attachment, how many runs and players),
//   - the class numbers: finished, still playing, not started and the average completion,
//   - the students (status, completion, attempts, best rank) and the locks the class got wrong most,
//   - the teacher's own latest run, and buttons for Preview, Student progress, View entries and View Lesson.
// Data: GET /rooms/:id (the campaign itself), GET /api/campaigns/:id/student-progress (the class numbers,
// see server/routes/studentProgress.js; only the teacher of the room gets them) and
// GET /api/campaigns/:id/results/latest (the teacher's own latest run). The full per-student table with
// every attempt stays on the Student progress page. Preview goes back to the room page asking it to play
// this campaign (the room page owns the game), the same way "Play again" on the results page does.

// Names for the lock classes the game sends (same names as the results page).
const LOCK_TYPE_LABELS = {
    DialogueQAInteractable: 'Conversation lock',
    ItemLockInteractable: 'Item lock',
    MagicLock: 'Magic lock',
    DialLockInteractable: 'Dial lock',
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

function TeacherCampaignPage() {
    useEnvironments()
    const { roomId, campaignId } = useParams()
    const navigate = useNavigate()

    const [room, setRoom] = useState(null)
    const [loadError, setLoadError] = useState('')
    const [progress, setProgress] = useState(null)
    const [progressError, setProgressError] = useState('')
    const [myRun, setMyRun] = useState(null)
    const [showEntries, setShowEntries] = useState(false)
    const [showAttachment, setShowAttachment] = useState(false)

    useEffect(() => {
        let cancelled = false
        setRoom(null)
        setProgress(null)
        setProgressError('')
        setMyRun(null)
        setLoadError('')

        const load = async () => {
            try {
                const { ok, status, data } = await api(`/rooms/${roomId}`)
                if (cancelled) return
                if (!ok) {
                    if (status === 401) {
                        clearSession()
                        navigate('/')
                        return
                    }
                    setLoadError(status === 403 ? 'This room belongs to another teacher.' : status === 404 ? "This room doesn't exist anymore." : errorMessage(data))
                    return
                }
                if (!(data.campaigns || []).some((c) => String(c.id) === String(campaignId))) {
                    setLoadError("This campaign isn't in this room anymore.")
                    return
                }
                setRoom(data)

                const [stats, latest] = await Promise.all([
                    api(`/campaigns/${campaignId}/student-progress`).catch(() => null),
                    api(`/campaigns/${campaignId}/results/latest`).catch(() => null),
                ])
                if (cancelled) return
                if (stats?.ok) setProgress(stats.data)
                else setProgressError(stats ? errorMessage(stats.data, "Couldn't load the class numbers.") : "Couldn't reach the server for the class numbers.")
                setMyRun(latest?.ok ? latest.data : null)
            } catch {
                if (!cancelled) setLoadError("Couldn't reach the server. Check your connection and try again.")
            }
        }
        load()
        return () => { cancelled = true }
    }, [roomId, campaignId, navigate])

    const campaigns = room?.campaigns || []
    const index = campaigns.findIndex((c) => String(c.id) === String(campaignId))
    const campaign = index >= 0 ? campaigns[index] : null

    const roomPath = `/teacher/room/${roomId}`
    const progressPath = `${roomPath}/campaign/${campaignId}/progress`
    const summary = progress?.summary
    const loadingStats = campaign && !progress && !progressError
    const students = progress?.students || []
    const hardestLocks = progress?.hardestLocks || []

    const handlePreview = () => navigate(roomPath, { state: { playCampaignId: campaign.id } })
    const handleViewRun = () => navigate(`/results/${campaign.id}`, { state: { roomId, replay: true } })

    const crumbs = [
        { label: 'Rooms', to: '/teacher/dashboard' },
        { label: room?.name || 'Room', to: roomPath },
        { label: campaign?.title || 'Campaign' },
    ]

    return (
        <div className="page" style={campaign ? sceneStyle(campaign.scene) : undefined}>
            <PageHeader
                breadcrumbs={<Breadcrumbs items={crumbs} />}
                eyebrow={campaign ? `Campaign ${index + 1}` : 'Campaign'}
                title={campaign ? campaign.title : loadError ? 'Campaign unavailable' : <Skeleton width={280} height={34} />}
                description={campaign?.description}
                actions={
                    campaign && (
                        <div className="row" style={{ "--gap": "8px" }}>
                            {campaign.attachmentFilename && (
                                <Button variant="secondary" icon={BookOpen} onClick={() => setShowAttachment(true)}>
                                    View Lesson
                                </Button>
                            )}
                            <Button variant="secondary" icon={Eye} onClick={() => setShowEntries(true)}>
                                View entries
                            </Button>
                            <Button variant="accent" icon={Play} onClick={handlePreview}>
                                Preview
                            </Button>
                        </div>
                    )
                }
            >
                {campaign && (
                    <div className="row" style={{ "--gap": "6px", marginTop: 12 }}>
                        <StatusChip status={campaign.isPublished ? 'published' : 'draft'} />
                        <SceneBadge scene={campaign.scene} />
                    </div>
                )}
            </PageHeader>

            {loadError && (
                <Alert tone="danger" title="We couldn't open this campaign" action={<Button size="sm" to={roomPath}>Back to the room</Button>}>
                    {loadError}
                </Alert>
            )}

            {!loadError && (
                <div className="stack" style={{ "--gap": "24px" }}>
                    <div className="stat-grid" style={{ "--cols": 4 }}>
                        <Stat icon={CheckCircle2} tone="success" label="Finished" value={summary ? `${summary.finished} of ${summary.students}` : '–'} />
                        <Stat icon={Clock} tone="info" label="Still playing" value={summary ? summary.playing : '–'} />
                        <Stat icon={Flag} tone="warning" label="Not started" value={summary ? summary.notStarted : '–'} />
                        <Stat icon={Sparkles} tone="primary" label="Average completion" value={summary && summary.averageCompletion != null ? `${summary.averageCompletion}%` : '–'} />
                    </div>

                    {progressError && <Alert tone="warning">{progressError}</Alert>}

                    <div className="split">
                        <div className="stack">
                            <section aria-labelledby="campaign-students-heading">
                                <div className="section__head">
                                    <h2 id="campaign-students-heading" className="detail-section-title">Students</h2>
                                    {campaign && (
                                        <Button size="sm" variant="soft" icon={ChartNoAxesColumn} to={progressPath}>
                                            Student progress
                                        </Button>
                                    )}
                                </div>
                                {loadingStats ? (
                                    <Skeleton height={120} />
                                ) : progressError ? null : students.length === 0 ? (
                                    <EmptyState plain icon={Users} title="No students in this room yet">
                                        Share the room code or add students, then their progress shows here.
                                    </EmptyState>
                                ) : (
                                    <Card flush>
                                        <table className="data-table">
                                            <caption className="sr-only">How each student is doing on this campaign</caption>
                                            <thead>
                                                <tr>
                                                    <th scope="col">Student</th>
                                                    <th scope="col">Status</th>
                                                    <th scope="col">Completion</th>
                                                    <th scope="col">Attempts</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {students.map((s) => (
                                                    <tr key={s.id}>
                                                        <td data-primary>
                                                            <span className="row row-nowrap" style={{ "--gap": "10px" }}>
                                                                <Avatar name={s.name} size={32} />
                                                                <span className="font-semibold">{s.name}</span>
                                                            </span>
                                                        </td>
                                                        <td data-label="Status"><StatusChip status={s.state} /></td>
                                                        <td data-label="Completion">
                                                            {s.current ? <CompletionBar percent={s.current.completionPercent} /> : <span className="text-sm text-muted">0%</span>}
                                                        </td>
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
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </Card>
                                )}
                            </section>

                            {hardestLocks.length > 0 && (
                                <section aria-labelledby="campaign-hardest-heading">
                                    <h2 id="campaign-hardest-heading" className="detail-section-title">Hardest locks</h2>
                                    <p className="text-sm text-muted">The locks the class got wrong most. A good place to re-teach.</p>
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
                                                {hardestLocks.map((lock) => (
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

                            <div>
                                <Button variant="secondary" to={roomPath}>
                                    Back to the room
                                </Button>
                            </div>
                        </div>

                        <aside className="stack" aria-labelledby="campaign-about-heading">
                            <Card>
                                <h2 id="campaign-about-heading" className="detail-section-title">About this campaign</h2>
                                {!campaign ? (
                                    <Skeleton height={120} />
                                ) : (
                                    <dl className="detail-facts">
                                        <div>
                                            <dt className="text-xs text-muted">Scene</dt>
                                            <dd><SceneBadge scene={campaign.scene} /></dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted">Status</dt>
                                            <dd>{campaign.isPublished ? 'Published, students can play it' : 'Draft, hidden from students'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted">Room</dt>
                                            <dd className="row" style={{ "--gap": "6px" }}>
                                                <DoorOpen size={16} aria-hidden="true" /> {room.name}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted">Play history</dt>
                                            <dd className="row" style={{ "--gap": "6px" }}>
                                                <Repeat size={16} aria-hidden="true" />
                                                {plural(campaign._count?.sessions || 0, 'finished run')} · {plural(campaign._count?.progress || 0, 'player')} with saved progress
                                            </dd>
                                        </div>
                                        {progress?.checkpointsTotal && (
                                            <div>
                                                <dt className="text-xs text-muted">Checkpoints</dt>
                                                <dd>{progress.checkpointsTotal}</dd>
                                            </div>
                                        )}
                                        {campaign.attachmentFilename && (
                                            <div>
                                                <dt className="text-xs text-muted">Attachment</dt>
                                                <dd>
                                                    <button type="button" className="attachment-chip attachment-chip--lead" onClick={() => setShowAttachment(true)}>
                                                        <Paperclip size={14} aria-hidden="true" />
                                                        <span className="truncate">{campaign.attachmentFilename}</span>
                                                        <Eye size={14} aria-hidden="true" />
                                                        <span className="sr-only">Open attachment</span>
                                                    </button>
                                                </dd>
                                            </div>
                                        )}
                                    </dl>
                                )}
                            </Card>

                            {myRun && (
                                <Card>
                                    <h2 className="detail-section-title">Your latest run</h2>
                                    <button
                                        type="button"
                                        className="quest-card__best quest-card__best--link"
                                        onClick={handleViewRun}
                                        aria-label={`View the results of your latest run: ${myRun.rank ? `Rank ${myRun.rank}` : 'no rank'}, ${formatDuration(myRun.totalTime)}`}
                                    >
                                        <RankMedal rank={myRun.rank} size={40} />
                                        <div className="grow">
                                            <p className="text-xs text-muted">Only you can see this</p>
                                            <p className="text-sm font-semibold">
                                                {myRun.rank ? `Rank ${myRun.rank}` : 'No rank'} · {formatDuration(myRun.totalTime)}
                                            </p>
                                            {myRun.completedAt && <p className="text-xs text-muted">{formatDate(myRun.completedAt)}</p>}
                                        </div>
                                        <ChevronRight size={18} aria-hidden="true" className="quest-card__best-arrow" />
                                    </button>
                                </Card>
                            )}
                        </aside>
                    </div>
                </div>
            )}

            {showEntries && campaign && <CampaignViewer campaignId={campaign.id} onClose={() => setShowEntries(false)} />}
            {showAttachment && campaign && <AttachmentPreviewModal campaign={campaign} onClose={() => setShowAttachment(false)} />}
        </div>
    )
}

export default TeacherCampaignPage
