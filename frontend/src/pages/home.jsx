import React, { useContext, useState, useEffect } from 'react'
import withAuth from '../utils/withAuth'
import { useNavigate } from 'react-router-dom'
import "../App.css";
import { Button } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import VideocamIcon from '@mui/icons-material/Videocam';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import EventNoteIcon from '@mui/icons-material/EventNote';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupIcon from '@mui/icons-material/Group';
import LogoutIcon from '@mui/icons-material/Logout';
import HistoryToggleOffIcon from '@mui/icons-material/HistoryToggleOff';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { AuthContext } from '../contexts/AuthContext';

function HomeComponent() {
    let navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");
    const [meetings, setMeetings] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    const { addToUserHistory, getHistoryOfUser } = useContext(AuthContext);

    const [isDark, setIsDark] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createdRoomCode, setCreatedRoomCode] = useState("");

    useEffect(() => {
        const savedTheme = localStorage.getItem("theme");
        if (savedTheme === "dark") {
            document.body.classList.add("dark-theme");
            setIsDark(true);
        } else {
            document.body.classList.remove("dark-theme");
            setIsDark(false);
        }
    }, []);

    const toggleTheme = () => {
        if (document.body.classList.contains("dark-theme")) {
            document.body.classList.remove("dark-theme");
            localStorage.setItem("theme", "light");
            setIsDark(false);
        } else {
            document.body.classList.add("dark-theme");
            localStorage.setItem("theme", "dark");
            setIsDark(true);
        }
    };

    // Fetch user history on mount
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const history = await getHistoryOfUser();
                setMeetings(history || []);
            } catch (e) {
                console.error("Failed to load user meeting history:", e);
            } finally {
                setLoadingHistory(false);
            }
        };
        fetchHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Generate random code in "xxx-yyy-zzz" format
    const generateRandomCode = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        let code = '';
        for (let i = 0; i < 9; i++) {
            if (i === 3 || i === 6) code += '-';
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    const handleCreateInstantMeeting = async () => {
        const randomCode = generateRandomCode();
        try {
            await addToUserHistory(randomCode);
            setCreatedRoomCode(randomCode);
            setShowCreateModal(true);
        } catch (e) {
            console.error("Error initiating meeting:", e);
            setCreatedRoomCode(randomCode);
            setShowCreateModal(true);
        }
    };

    const handleJoinVideoCall = async () => {
        if (!meetingCode.trim()) return;
        try {
            await addToUserHistory(meetingCode);
            navigate(`/meeting/${meetingCode}`);
        } catch (e) {
            console.error("Error joining meeting:", e);
            navigate(`/meeting/${meetingCode}`); // fallback
        }
    };

    const handleJoinAgain = async (code) => {
        try {
            await addToUserHistory(code);
            navigate(`/meeting/${code}`);
        } catch (e) {
            console.error("Error joining again:", e);
            navigate(`/meeting/${code}`);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Calculate real stats
    const totalMeetingsCount = meetings.length;
    const estimatedHours = (totalMeetingsCount * 0.6).toFixed(1);
    const uniqueRooms = new Set(meetings.map(m => m.meetingCode)).size;

    return (
        <div className="dashboardContainer">
            {/* Top Navigation */}
            <div className="dashboardNav">
                <div className="dashboardLogo">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, cursor: 'pointer' }} onClick={() => navigate("/")}>
                        <VideocamIcon style={{ color: '#2563EB', fontSize: '1.6rem' }} />
                        SANGAMA
                    </h2>
                </div>

                <div className="dashboardNavRight">
                    <button className="btn-theme-toggle" onClick={toggleTheme} title="Toggle dark mode" style={{ margin: 0 }}>
                        {isDark ? <LightModeIcon style={{ fontSize: '1.25rem' }} /> : <DarkModeIcon style={{ fontSize: '1.25rem' }} />}
                    </button>
                    <Button
                        startIcon={<RestoreIcon />}
                        onClick={() => navigate("/history")}
                        style={{ textTransform: 'none', fontWeight: 600, color: '#64748B' }}
                    >
                        History
                    </Button>
                    <button
                        className="btn-logout"
                        onClick={() => {
                            localStorage.removeItem("token");
                            navigate("/auth");
                        }}
                    >
                        <LogoutIcon style={{ fontSize: '1.1rem', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                        Logout
                    </button>
                </div>
            </div>

            {/* Dashboard Content */}
            <div className="dashboardContent">
                {/* Welcome section */}
                <div className="welcomeBanner">
                    <h1>Welcome to your workspace</h1>
                    <p>Schedule, create, or join video conferences instantly from one central dashboard.</p>
                </div>

                {/* Dashboard grid */}
                <div className="dashboardGrid">
                    {/* Left Column: Actions and History */}
                    <div className="dashboardMainPanel">
                        {/* Quick Action Cards */}
                        <div className="quickActionsGrid">
                            <div className="actionCard">
                                <div>
                                    <div className="actionIcon">
                                        <VideocamIcon style={{ fontSize: '1.5rem' }} />
                                    </div>
                                    <h3>Create Meeting</h3>
                                    <p>Start a new instant video room and invite participants in seconds.</p>
                                </div>
                                <button className="btn-full" onClick={handleCreateInstantMeeting}>
                                    Start Instant Meeting
                                </button>
                            </div>

                            <div className="actionCard">
                                <div>
                                    <div className="actionIcon secondary">
                                        <KeyboardIcon style={{ fontSize: '1.5rem' }} />
                                    </div>
                                    <h3>Join Meeting</h3>
                                    <p>Enter a meeting code or invitation URL link to join an active call.</p>
                                </div>
                                <div className="actionForm">
                                    <input
                                        type="text"
                                        placeholder="Enter meeting code..."
                                        value={meetingCode}
                                        onChange={e => setMeetingCode(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleJoinVideoCall(); }}
                                    />
                                    <button onClick={handleJoinVideoCall}>Join</button>
                                </div>
                            </div>
                        </div>

                        {/* Recent Meetings Panel */}
                        <div className="dashboardPanel">
                            <div className="panelHeader">
                                <h2>Recent Activities</h2>
                                <HistoryToggleOffIcon style={{ color: '#64748B' }} />
                            </div>

                            {loadingHistory ? (
                                <p style={{ color: '#64748B', fontSize: '0.9rem' }}>Loading past meetings...</p>
                            ) : meetings.length !== 0 ? (
                                <div className="meetingsList">
                                    {meetings.slice(0, 4).map((meeting, index) => (
                                        <div className="meetingItem" key={index}>
                                            <div className="meetingItemInfo">
                                                <h4>Code: {meeting.meetingCode}</h4>
                                                <p>Date: {formatDate(meeting.date)}</p>
                                            </div>
                                            <button
                                                className="btn-item-action"
                                                onClick={() => handleJoinAgain(meeting.meetingCode)}
                                            >
                                                Join Again
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="emptyState">
                                    <p>No meetings found in your history log. Start your first session!</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Statistics & Schedule */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Summary Stats Panel - Conditional on existing history logs */}
                        {meetings.length > 0 && (
                            <div className="dashboardPanel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <EqualizerIcon style={{ color: '#2563EB' }} />
                                    Your Activity Statistics
                                </h2>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                                        <div className="boardStatIcon">
                                            <VideocamIcon style={{ fontSize: '1.25rem' }} />
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{totalMeetingsCount}</h4>
                                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B' }}>Total Meetings</p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div className="boardStatIcon" style={{ color: '#F59E0B', background: 'rgba(245, 158, 11, 0.06)' }}>
                                            <GroupIcon style={{ fontSize: '1.25rem' }} />
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{uniqueRooms}</h4>
                                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B' }}>Unique Channels</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Upcoming meetings card */}
                        <div className="dashboardPanel">
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <EventNoteIcon style={{ color: '#10B981' }} />
                                Scheduled Meetings
                            </h2>
                            <div className="emptyState" style={{ padding: '1rem 0' }}>
                                <p style={{ fontSize: '0.85rem' }}>No upcoming events scheduled for today.</p>
                                <Button
                                    size="small"
                                    style={{ textTransform: 'none', fontWeight: 600, marginTop: '0.5rem' }}
                                    onClick={() => alert("Calendar integrations can be configured inside Settings.")}
                                >
                                    Schedule Meeting
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Google Meet Style Modal */}
            {showCreateModal && (
                <div className="meet-modal-overlay">
                    <div className="meet-modal-card">
                        <button className="meet-modal-close" onClick={() => setShowCreateModal(false)} title="Close">
                            <CloseIcon style={{ fontSize: '1.25rem' }} />
                        </button>
                        <h3 className="meet-modal-title">Here's your meeting link</h3>
                        <p className="meet-modal-desc">Copy this link and send it to people you want to meet with. Make sure you save it so you can use it later.</p>
                        <div className="meet-modal-link-box">
                            <span className="meet-modal-link">
                                {window.location.origin + "/meeting/" + createdRoomCode}
                            </span>
                            <button
                                className="meet-modal-copy-btn"
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.origin + "/meeting/" + createdRoomCode);
                                    alert("Link copied!");
                                }}
                                title="Copy link"
                            >
                                <ContentCopyIcon style={{ fontSize: '1.1rem' }} />
                            </button>
                        </div>
                        <div className="meet-modal-actions">
                            <button className="btn-full" onClick={() => navigate(`/meeting/${createdRoomCode}`)}>
                                Join Meeting
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default withAuth(HomeComponent)