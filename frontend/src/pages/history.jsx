import React, { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom';
import withAuth from '../utils/withAuth';
import HomeIcon from '@mui/icons-material/Home';
import VideocamIcon from '@mui/icons-material/Videocam';
import HistoryToggleOffIcon from '@mui/icons-material/HistoryToggleOff';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';

import { Button } from '@mui/material';

function History() {
    const { getHistoryOfUser } = useContext(AuthContext);
    const [meetings, setMeetings] = useState([])
    const [loading, setLoading] = useState(true);
    const [isDark, setIsDark] = useState(false);

    const routeTo = useNavigate();

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

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const history = await getHistoryOfUser();
                setMeetings(history || []);
            } catch (e) {
                console.error("Failed to fetch meeting history:", e);
            } finally {
                setLoading(false);
            }
        }
        fetchHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0")
        const year = date.getFullYear();
        return `${day}/${month}/${year}`
    }

    return (
        <div className="dashboardContainer">
            {/* Navigation Header */}
            <div className="dashboardNav">
                <div className="dashboardLogo">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, cursor: 'pointer' }} onClick={() => routeTo("/home")}>
                        <VideocamIcon style={{ color: '#2563EB', fontSize: '1.6rem' }} />
                        SANGAMA
                    </h2>
                </div>
                <div className="dashboardNavRight">
                    <button className="btn-theme-toggle" onClick={toggleTheme} title="Toggle dark mode" style={{ margin: 0 }}>
                        {isDark ? <LightModeIcon style={{ fontSize: '1.25rem' }} /> : <DarkModeIcon style={{ fontSize: '1.25rem' }} />}
                    </button>
                    <Button 
                        startIcon={<HomeIcon />} 
                        onClick={() => routeTo("/home")}
                        style={{ textTransform: 'none', fontWeight: 600, color: '#2563EB' }}
                    >
                        Back to Home
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="dashboardContent" style={{ maxWidth: '800px' }}>
                {/* Back button shortcut */}
                <div className="btn-back-home" onClick={() => routeTo("/home")}>
                    <ArrowBackIcon style={{ fontSize: '1.1rem' }} />
                    Back to Dashboard
                </div>

                <div className="welcomeBanner" style={{ marginBottom: '2rem' }}>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <HistoryToggleOffIcon style={{ fontSize: '2rem', color: '#2563EB' }} />
                        Meeting Logs & History
                    </h1>
                    <p>Review and reconnect to all past video conferences hosted or joined from this account.</p>
                </div>

                {/* Log display */}
                <div className="dashboardPanel">
                    {loading ? (
                        <p style={{ color: '#64748B', fontSize: '0.95rem' }}>Retrieving your past logs...</p>
                    ) : (Array.isArray(meetings) && meetings.length !== 0) ? (
                        <div className="meetingsList" style={{ gap: '1.25rem' }}>
                            {meetings.map((meeting, index) => (
                                <div className="meetingItem" key={index} style={{ padding: '1.25rem' }}>
                                    <div className="meetingItemInfo" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        <h4 style={{ fontSize: '1.05rem', color: '#0F172A', fontWeight: 700 }}>
                                            Meeting ID: <span style={{ fontFamily: 'monospace', color: '#2563EB' }}>{meeting.meetingCode}</span>
                                        </h4>
                                        <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748B', margin: 0 }}>
                                            <CalendarTodayIcon style={{ fontSize: '0.9rem' }} />
                                            Joined on {formatDate(meeting.date)}
                                        </p>
                                    </div>
                                    <button 
                                        className="btn-item-action"
                                        style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
                                        onClick={() => {
                                            routeTo(`/meeting/${meeting.meetingCode}`);
                                        }}
                                    >
                                        Reconnect
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="emptyState" style={{ padding: '4rem 0' }}>
                            <p style={{ fontSize: '1rem', marginBottom: '1rem' }}>No meeting history logs found.</p>
                            <Button 
                                variant="contained" 
                                color="primary"
                                onClick={() => routeTo("/home")}
                                style={{ borderRadius: '12px', textTransform: 'none', padding: '0.6rem 1.5rem' }}
                            >
                                Start a Meeting
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default withAuth(History);
