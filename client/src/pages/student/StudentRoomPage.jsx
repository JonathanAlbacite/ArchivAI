import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Map as MapIcon } from 'lucide-react'
import GameStage from '../../components/game/GameStage'
import CampaignQuestCard from '../../components/student/CampaignQuestCard'
import RoomMembers from '../../components/RoomMembers'
import AttachmentPreviewModal from '../../components/AttachmentPreviewModal'
import { BooksArt } from '../../components/Illustrations'
import { Alert, Breadcrumbs, Button, EmptyState, PageHeader, Skeleton, SkeletonCards } from '../../components/ui'
import useRoomMembers from '../../lib/useRoomMembers'
import { api, errorMessage } from '../../lib/api'
import { fetchCampaignStatus } from '../../lib/studentProgress'
import { clearSession } from '../../lib/session'
import { useToast } from '../../lib/toast'

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
    const [playError, setPlayError] = useState(null)
    const [previewCampaign, setPreviewCampaign] = useState(null)

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
    const handlePlay = async (campaign) => {
        setPlayError(null)
        setStartingId(campaign.id)

        try {
            const { ok, data } = await api(`/rooms/${id}/active-campaign`, {
                method: "PATCH",
                body: { campaignId: campaign.id },
            })
            if (!ok) throw new Error(errorMessage(data, "Could not start this campaign"))
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
        navigate(location.pathname, { replace: true, state: null })
        const campaign = room.campaigns?.find((c) => c.id === autoPlayId)
        if (campaign) {
            const t = setTimeout(() => handlePlay(campaign), 0)
            return () => clearTimeout(t)
        }
        // handlePlay is recreated each render; this only needs to run once per autoplay request
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room, autoPlayId])

    const handleReturnToRoom = () => {
        setActiveCampaign(null)
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
                                            onPlay={handlePlay}
                                            onPreviewAttachment={setPreviewCampaign}
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
                <AttachmentPreviewModal campaign={previewCampaign} onClose={() => setPreviewCampaign(null)} />
            )}
        </div>
    )
}

export default StudentRoomPage
