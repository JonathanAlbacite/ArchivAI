import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { LogOut, Map as MapIcon } from 'lucide-react'
import GameStage from '../../components/game/GameStage'
import CampaignQuestCard from '../../components/student/CampaignQuestCard'
import RoomMembers from '../../components/RoomMembers'
import AttachmentPreviewModal from '../../components/AttachmentPreviewModal'
import { BooksArt } from '../../components/Illustrations'
import { Alert, Breadcrumbs, Button, ConfirmDialog, EmptyState, PageHeader, Skeleton, SkeletonCards } from '../../components/ui'
import useRoomMembers from '../../lib/useRoomMembers'
import { api, errorMessage } from '../../lib/api'
import { fetchCampaignStatus } from '../../lib/studentProgress'
import { clearSession } from '../../lib/session'
import { useToast } from '../../lib/toast'
import { useReadingProgress } from '../../lib/readingProgress'

function StudentRoomPage() {
    const { id } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const toast = useToast()
    const [room, setRoom] = useState(null)
    const [loadError, setLoadError] = useState("")
    const [statuses, setStatuses] = useState({})
    const [reloadKey, setReloadKey] = useState(0)
    const members = useRoomMembers(id)
    const [activeCampaign, setActiveCampaign] = useState(null)
    const [startingId, setStartingId] = useState(null)
    // Where leaving the game goes: "campaign" when the game was started from the campaign page, so
    // Back returns there instead of skipping to the room; otherwise the room.
    const [exitTo, setExitTo] = useState(null)
    const [playError, setPlayError] = useState(null)
    // The campaign whose lesson file is open in the viewer.
    const [previewCampaign, setPreviewCampaign] = useState(null)
    // Leaving the room: the confirm dialog is open, the request is running, or it failed.
    const [confirmLeave, setConfirmLeave] = useState(false)
    const [leaving, setLeaving] = useState(false)
    const [leaveError, setLeaveError] = useState("")

    // Scrolling to the end of a lesson file unlocks Play on its card (the server saves the read).
    const handleLessonRead = useCallback((campaign) => {
        setRoom((r) => r && { ...r, campaigns: r.campaigns.map((c) => (c.id === campaign.id ? { ...c, readByMe: true } : c)) })
    }, [])
    const reading = useReadingProgress(handleLessonRead)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const { ok, status, data } = await api(`/rooms/${id}`)
                if (cancelled) return
                if (!ok) {
                    if (status === 401) {
                        clearSession()
                        navigate("/")
                        return
                    }
                    setLoadError(status === 403 ? "You're not a member of this room." : status === 404 ? "This room doesn't exist anymore." : errorMessage(data))
                    return
                }
                setLoadError("")
                setRoom(data)
                // Each quest's completion / last rank, loaded alongside.
                const entries = await Promise.all((data.campaigns || []).map(async (c) => [c.id, await fetchCampaignStatus(c.id)]))
                if (!cancelled) setStatuses(Object.fromEntries(entries))
            } catch {
                if (!cancelled) setLoadError("Couldn't reach the server. Check your connection and try again.")
            }
        }
        load()
        return () => { cancelled = true }
    }, [id, navigate, reloadKey])

    // Marks this room's active campaign server-side BEFORE the game mounts -
    // Unity only ever receives {token, roomId} (see UnityGame.jsx), then
    // asks the API which campaign is currently active for that room. If
    // that PATCH fails, the game never opens and the player never sees
    // a game that would just fail to find a campaign to load.
    const handlePlay = async (campaign, origin = null) => {
        setPlayError(null)
        // A lesson file must be scrolled to the end first - open it instead of the game.
        if (campaign.attachmentFilename && !campaign.readByMe) {
            setPreviewCampaign(campaign)
            return
        }
        setStartingId(campaign.id)

        try {
            const { ok, data } = await api(`/rooms/${id}/active-campaign`, {
                method: "PATCH",
                body: { campaignId: campaign.id },
            })
            if (!ok) throw new Error(errorMessage(data, "Could not start this campaign"))
            setExitTo(origin)
            setActiveCampaign(campaign)
        } catch (err) {
            setPlayError(err.message === "Failed to fetch" ? "Couldn't reach the server. Check your connection and try again." : err.message)
        } finally {
            setStartingId(null)
        }
    }

    // "Retry" on the results page comes back here asking to replay a quest.
    const autoPlayId = location.state?.playCampaignId
    const autoPlayed = useRef(false)
    useEffect(() => {
        if (!room || !autoPlayId || autoPlayed.current) return
        autoPlayed.current = true
        const origin = location.state?.fromCampaign ? "campaign" : null
        navigate(location.pathname, { replace: true, state: null })
        const campaign = room.campaigns?.find((c) => c.id === autoPlayId)
        if (campaign) {
            const t = setTimeout(() => handlePlay(campaign, origin), 0)
            return () => clearTimeout(t)
        }
        // handlePlay is recreated each render; this only needs to run once per autoplay request
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room, autoPlayId])

    const handleReturnToRoom = () => {
        const backTo = exitTo === "campaign" && activeCampaign ? activeCampaign.id : null
        setActiveCampaign(null)
        setExitTo(null)
        setReloadKey((k) => k + 1)
        if (backTo !== null) navigate(`/student/room/${id}/campaign/${backTo}`)
    }

    // The Latest run box on a campaign card. Opens that run's results page; replay makes the page play
    // the calculating screen and the score animation again (see RunResults.jsx).
    const handleViewRun = (campaign) => {
        navigate(`/results/${campaign.id}`, { state: { roomId: id, replay: true } })
    }

    const handleLeave = async () => {
        setLeaving(true)
        setLeaveError("")
        try {
            const { ok, data } = await api(`/rooms/${id}/leave`, { method: "DELETE" })
            if (!ok) throw new Error(errorMessage(data, "Couldn't leave the room"))
            toast.success(`You left ${room?.name || "the room"}.`)
            navigate("/student/dashboard")
        } catch (err) {
            setLeaveError(err.message === "Failed to fetch" ? "Couldn't reach the server. Check your connection and try again." : err.message)
            setLeaving(false)
        }
    }

    // Closing the lesson re-checks the room, so a lesson that was just finished shows Play unlocked
    // even if the unlock happened while the viewer was open.
    const closePreview = () => {
        setPreviewCampaign(null)
        setReloadKey((k) => k + 1)
    }

    const handleGameError = () => {
        setPlayError("The game failed to load. Check your connection and try again.")
        setActiveCampaign(null)
    }

    // The game raises this when a run ends. A saved run opens its results page. If the website
    // could not save it, the player is told and returns to the room.
    const handleRunFinished = ({ campaignId, saved }) => {
        if (saved) {
            navigate(`/results/${campaignId}`, { state: { roomId: id } })
            return
        }
        toast.error("Your run finished, but the results could not be saved. Check your connection and try again.", { title: "Results not saved" })
        handleReturnToRoom()
    }

    if (activeCampaign) {
        return (
            <GameStage
                campaign={activeCampaign}
                roomId={id}
                exitTarget={exitTo === "campaign" ? "campaign" : "room"}
                onExit={handleReturnToRoom}
                onError={handleGameError}
                onRunFinished={handleRunFinished}
            />
        )
    }

    const campaigns = room?.campaigns || []
    const doneCount = campaigns.filter((c) => statuses[c.id]?.state === "completed").length

    return (
        <div className="page">
            <PageHeader
                breadcrumbs={<Breadcrumbs items={[{ label: "Dashboard", to: "/student/dashboard" }, { label: room?.name || "Room" }]} />}
                eyebrow="Room"
                title={room ? room.name : loadError ? "Room unavailable" : <Skeleton width={260} height={34} />}
                description={room?.description || (members?.owner?.name ? `Hosted by ${members.owner.name}` : undefined)}
                actions={room && (
                    <Button variant="danger-ghost" icon={LogOut} onClick={() => setConfirmLeave(true)}>
                        Leave room
                    </Button>
                )}
            />

            {loadError && (
                <Alert tone="danger" title="We couldn't open this room" action={<Button size="sm" to="/student/dashboard">Back to dashboard</Button>}>
                    {loadError}
                </Alert>
            )}

            {!loadError && (
                <div className="split">
                    <section aria-labelledby="quests-heading">
                        <div className="section__head">
                            <div>
                                <h2 id="quests-heading" className="section__title row" style={{ "--gap": "8px" }}>
                                    <MapIcon size={20} aria-hidden="true" /> Campaigns
                                </h2>
                                {room && campaigns.length > 0 && (
                                    <p className="text-sm text-muted">{doneCount} of {campaigns.length} completed · play them in any order</p>
                                )}
                            </div>
                        </div>

                        {playError && (
                            <Alert tone="danger" title="Couldn't start the campaign" className="section__alert">
                                {playError}
                            </Alert>
                        )}

                        {!room ? (
                            <SkeletonCards count={2} height={320} />
                        ) : campaigns.length === 0 ? (
                            <EmptyState art={<BooksArt />} title="No campaigns yet">
                                Your teacher hasn't published a campaign in this room yet.
                            </EmptyState>
                        ) : (
                            <ol className="quest-path" role="list">
                                {campaigns.map((campaign, i) => (
                                    <li key={campaign.id}>
                                        <CampaignQuestCard
                                            campaign={campaign}
                                            number={i + 1}
                                            status={statuses[campaign.id]}
                                            starting={startingId === campaign.id}
                                            disabled={startingId !== null && startingId !== campaign.id}
                                            readLevel={reading.levelOf(campaign)}
                                            onPlay={handlePlay}
                                            onPreviewAttachment={setPreviewCampaign}
                                            onViewRun={handleViewRun}
                                            onOpen={(c) => navigate(`/student/room/${id}/campaign/${c.id}`)}
                                        />
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>

                    <aside aria-label="Room members">
                        <RoomMembers members={members} />
                    </aside>
                </div>
            )}

            {previewCampaign && (
                <AttachmentPreviewModal
                    campaign={previewCampaign}
                    onClose={closePreview}
                    unlocked={!!room?.campaigns?.find((c) => c.id === previewCampaign.id)?.readByMe}
                    onPlay={() => {
                        const campaign = previewCampaign
                        closePreview()
                        handlePlay({ ...campaign, readByMe: true })
                    }}
                    onProgress={previewCampaign.readByMe ? undefined : (fraction) => reading.report(previewCampaign, fraction)}
                />
            )}

            {confirmLeave && (
                <ConfirmDialog
                    title={`Leave ${room?.name || "this room"}?`}
                    confirmLabel="Leave room"
                    loading={leaving}
                    error={leaveError}
                    onCancel={() => { setConfirmLeave(false); setLeaveError("") }}
                    onConfirm={handleLeave}
                >
                    <p>You won't see this room's campaigns anymore. Your past results are kept, and you can join again with the room code.</p>
                </ConfirmDialog>
            )}
        </div>
    )
}

export default StudentRoomPage
