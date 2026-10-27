import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowLeft, Clock, XCircle, Flag, CheckCircle2, Circle } from 'lucide-react'
import dashboard_bg from '../assets/dashboard_bg.png'
import Navbar from '../components/Navbar'
import EmberField from '../components/EmberField'
import { getSceneMeta } from '../scenes'
import { colors, fonts } from '../theme'

// RunResults.jsx
//
// The results page of a finished run. The game (CampaignProgressTracker) sends the run to
// POST /api/campaigns/:id/results, then tells the page through the "archivai:run-finished"
// window event (see UnityGame.jsx), and the room page opens this page. It shows the newest
// finished run of the logged-in user for the campaign, from GET /api/campaigns/:id/results/latest.
//
// roomId is passed in the router state by the room page so "Back to room" knows where to go.
// If the page is opened without it (e.g. after a refresh), the button goes to the dashboard.

// CampaignLockManager sends the lock's class name as its type.
const LOCK_TYPE_LABELS = {
    DialogueQAInteractable: 'Conversation lock',
    ItemLockInteractable: 'Item lock',
    MagicLock: 'Magic lock',
    DialLockInteractable: 'Dial lock',
}

const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '-'
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`
}

function RunResults() {
    const { campaignId } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)

    const roomId = location.state?.roomId
    const role = localStorage.getItem('role')

    useEffect(() => {
        const fetchResult = async () => {
            const token = localStorage.getItem('token')
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${campaignId}/results/latest`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(data.message || 'Could not load the results')
                setResult(data)
            } catch (err) {
                setError(err.message)
            }
        }
        fetchResult()
    }, [campaignId])

    const handleBack = () => {
        if (role === 'STUDENT') navigate(roomId ? `/student/room/${roomId}` : '/student/dashboard')
        else if (role === 'ADMIN') navigate('/admin/dashboard')
        else navigate(roomId ? `/teacher/room/${roomId}` : '/teacher/dashboard')
    }

    const sceneMeta = getSceneMeta(result?.scene)
    const statCard = { flex: 1, minWidth: '140px', backgroundColor: 'rgba(255,255,255,0.45)', border: `1px solid ${colors.magicViolet}55`, borderRadius: '16px', padding: '16px 20px' }
    const statLabel = { display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 6px 0', fontFamily: fonts.body, fontSize: '12px', color: colors.inkMuted }
    const statValue = { margin: 0, fontFamily: fonts.display, fontSize: '26px', color: colors.ink }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />

            <div style={{ position: 'relative', display: 'flex', minHeight: '100vh', backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(139,111,179,0.25), rgba(243,233,215,0.85)), url(${dashboard_bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>

                <EmberField variant="sparkle" count={22} />

                <div style={{ position: 'relative', backgroundColor: colors.parchmentDark, flex: 1, borderRadius: '24px', margin: '20px', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', border: `1px solid ${colors.magicViolet}55` }}>
                    <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto' }}>

                        <button
                            onClick={handleBack}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', color: colors.magicViolet, border: `1px solid ${colors.magicViolet}55`, borderRadius: '16px', padding: '8px 16px', fontFamily: fonts.body, fontWeight: '600', fontSize: '13px', cursor: 'pointer', marginBottom: '24px' }}
                        >
                            <ArrowLeft size={14} /> {roomId ? 'Back to Room' : 'Back to Dashboard'}
                        </button>

                        {error && (
                            <p style={{ fontFamily: fonts.body, fontSize: '14px', color: colors.danger }}>{error}</p>
                        )}

                        {!error && !result && (
                            <p style={{ fontFamily: fonts.body, color: colors.inkMuted }}>Loading your results...</p>
                        )}

                        {result && (
                            <>
                                <p style={{ margin: '0 0 4px 0', fontFamily: fonts.flourish, fontSize: '12px', letterSpacing: '3px', color: colors.magicViolet }}>
                                    RUN COMPLETE
                                </p>
                                <h1 style={{ fontFamily: fonts.displayDecorative, fontSize: '32px', color: colors.ink, margin: '0 0 6px 0' }}>
                                    {result.campaignTitle}
                                </h1>
                                <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: fonts.body, fontSize: '14px', color: colors.inkMuted, margin: '0 0 28px 0' }}>
                                    <sceneMeta.Icon size={16} color={sceneMeta.color} /> {sceneMeta.label}
                                </p>

                                {/* Rank */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', backgroundColor: 'rgba(255,255,255,0.45)', border: `1px solid ${colors.magicViolet}55`, borderRadius: '24px', padding: '24px 32px', marginBottom: '16px' }}>
                                    <p style={{ margin: 0, fontFamily: fonts.displayDecorative, fontSize: '72px', lineHeight: 1, color: colors.magicViolet }}>
                                        {result.rank || '-'}
                                    </p>
                                    <div>
                                        <p style={{ margin: '0 0 4px 0', fontFamily: fonts.flourish, fontSize: '12px', letterSpacing: '3px', color: colors.magicViolet }}>RANK</p>
                                        <p style={{ margin: 0, fontFamily: fonts.body, fontSize: '13px', color: colors.inkMuted }}>
                                            Based on your time and the mistakes you made.
                                        </p>
                                    </div>
                                </div>

                                {/* Totals */}
                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
                                    <div style={statCard}>
                                        <p style={statLabel}><Clock size={14} /> Total time</p>
                                        <p style={statValue}>{formatTime(result.totalTime)}</p>
                                    </div>
                                    <div style={statCard}>
                                        <p style={statLabel}><XCircle size={14} /> Mistakes</p>
                                        <p style={statValue}>{result.mistakes ?? '-'}</p>
                                    </div>
                                    <div style={statCard}>
                                        <p style={statLabel}><Flag size={14} /> Checkpoints</p>
                                        <p style={statValue}>
                                            {result.checkpointsReached === null || result.checkpointsTotal === null
                                                ? '-'
                                                : `${result.checkpointsReached} of ${result.checkpointsTotal}`}
                                        </p>
                                    </div>
                                </div>

                                {/* Locks */}
                                <h2 style={{ fontFamily: fonts.display, color: colors.ink, margin: '0 0 12px 0' }}>Locks</h2>

                                {result.locks.length === 0 ? (
                                    <p style={{ fontFamily: fonts.body, fontSize: '14px', color: colors.inkMuted }}>
                                        No lock results were recorded for this run.
                                    </p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {result.locks.map((lock) => (
                                            <div
                                                key={lock.id || lock.order}
                                                style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'rgba(255,255,255,0.45)', border: `1px solid ${colors.magicViolet}55`, borderRadius: '16px', padding: '12px 18px' }}
                                            >
                                                {lock.isSolved
                                                    ? <CheckCircle2 size={20} color={colors.success} />
                                                    : <Circle size={20} color={colors.danger} />}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontFamily: fonts.body, fontWeight: '600', fontSize: '14px', color: colors.ink }}>
                                                        Lock {lock.order}: {LOCK_TYPE_LABELS[lock.type] || lock.type}
                                                    </p>
                                                    <p style={{ margin: '2px 0 0 0', fontFamily: fonts.body, fontSize: '12px', color: lock.isSolved ? colors.success : colors.danger }}>
                                                        {lock.isSolved ? 'Solved' : 'Not solved'}
                                                    </p>
                                                </div>
                                                <p style={{ margin: 0, fontFamily: fonts.body, fontSize: '13px', color: colors.inkMuted }}>
                                                    {lock.attempts} {lock.attempts === 1 ? 'mistake' : 'mistakes'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RunResults
