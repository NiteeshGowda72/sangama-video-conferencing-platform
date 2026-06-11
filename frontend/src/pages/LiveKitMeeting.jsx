import React, { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    LiveKitRoom,
    RoomAudioRenderer,
    VideoTrack,
    useLocalParticipant,
    useRemoteParticipants,
    useRoomContext,
    useChat,
} from "@livekit/components-react";
import { Badge, IconButton, Snackbar } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import PeopleIcon from '@mui/icons-material/People';
import CallEndIcon from '@mui/icons-material/CallEnd';

import styles from "../styles/videoComponent.module.css";

function CustomConferenceRoom({ onLeaveRequest }) {
    const room = useRoomContext();
    const { localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant();
    const remoteParticipants = useRemoteParticipants();
    const { chatMessages, send } = useChat();

    // UI Panel / overlay states
    const [showModal, setModal] = useState(false); // Chat Drawer
    const [showParticipants, setShowParticipants] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [message, setMessage] = useState("");
    const [timer, setTimer] = useState(0);

    const [unreadMessages, setUnreadMessages] = useState(0);
    const prevMessagesCount = useRef(0);
    const showModalRef = useRef(showModal);

    const [screenAvailable, setScreenAvailable] = useState(false);

    useEffect(() => {
        showModalRef.current = showModal;
    }, [showModal]);

    // Check for screen sharing capability
    useEffect(() => {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
            setScreenAvailable(true);
        }
    }, []);

    // Unread messages counting logic
    useEffect(() => {
        if (chatMessages.length > prevMessagesCount.current) {
            const newMsgs = chatMessages.slice(prevMessagesCount.current);
            if (!showModalRef.current) {
                const incoming = newMsgs.filter(m => !m.from?.isLocal);
                setUnreadMessages(prev => prev + incoming.length);
            }
            prevMessagesCount.current = chatMessages.length;
        }
    }, [chatMessages]);

    // Ticking timer
    useEffect(() => {
        const interval = setInterval(() => {
            setTimer(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const copyMeetingCode = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopySuccess(true);
    };

    const toggleChat = () => {
        setModal(prev => {
            const next = !prev;
            if (next) {
                setShowParticipants(false);
                setUnreadMessages(0);
            }
            return next;
        });
    };

    const toggleParticipants = () => {
        setShowParticipants(prev => {
            const next = !prev;
            if (next) setModal(false);
            return next;
        });
    };

    const closeChat = () => {
        setModal(false);
    };

    const handleSendMessage = () => {
        if (!message.trim()) return;
        send(message);
        setMessage("");
    };

    const handleEndCall = () => {
        onLeaveRequest();
    };

    const totalParticipants = 1 + remoteParticipants.length;
    const gridClass = totalParticipants <= 9 ? `participants-${totalParticipants}` : 'participants-9';

    return (
        <div className={styles.meetVideoContainer}>
            {/* Left Info Badges Overlay */}
            <div className={styles.meetingInfoBadge}>
                <div className={styles.meetingCodeBadge}>
                    Room: {room?.name || window.location.pathname.substring(1)}
                </div>
                <button className={styles.btnIconSm} title="Copy invitation link" onClick={copyMeetingCode}>
                    <ContentCopyIcon style={{ fontSize: '1rem' }} />
                </button>
                <div className={styles.meetingTimerBadge}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', marginRight: '0.25rem' }}></span>
                    {formatTime(timer)}
                </div>
            </div>

            {/* Chat Room Side Panel */}
            {showModal && (
                <div className={styles.chatRoom}>
                    <div className={styles.chatContainer}>
                        <div className={styles.chatHeader}>
                            <h3>Meeting Chat</h3>
                            <IconButton size="small" onClick={closeChat} style={{ color: 'white' }}>
                                <CloseIcon style={{ fontSize: '1.25rem' }} />
                            </IconButton>
                        </div>

                        <div className={styles.chattingDisplay}>
                            {chatMessages.length !== 0 ? chatMessages.map((item, index) => {
                                const isSelf = item.from?.isLocal;
                                const senderName = isSelf ? 'You' : (item.from?.identity || 'Guest');
                                return (
                                    <div
                                        className={`${styles.chatMessage} ${isSelf ? styles.self : ''}`}
                                        key={index}
                                    >
                                        <span className={styles.chatMessageSender}>
                                            {senderName}
                                        </span>
                                        <div className={styles.chatMessageBubble}>
                                            {item.message}
                                        </div>
                                    </div>
                                )
                            }) : (
                                <div style={{ textAlign: 'center', color: '#64748B', fontSize: '0.85rem', marginTop: '2rem' }}>
                                    No messages yet. Say hello to participants!
                                </div>
                            )}
                        </div>

                        <div className={styles.chattingArea}>
                            <input
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="Type a message..."
                                onKeyDown={e => { if (e.key === 'Enter') handleSendMessage(); }}
                            />
                            <button onClick={handleSendMessage}>Send</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Participants Side Panel */}
            {showParticipants && (
                <div className={styles.participantsRoom}>
                    <div className={styles.chatHeader}>
                        <h3>Participants ({totalParticipants})</h3>
                        <IconButton size="small" onClick={() => setShowParticipants(false)} style={{ color: 'white' }}>
                            <CloseIcon style={{ fontSize: '1.25rem' }} />
                        </IconButton>
                    </div>
                    <div className={styles.participantsList}>
                        {/* Local Participant Row */}
                        <div className={styles.participantRow}>
                            <div className={styles.participantLeft}>
                                <div className={styles.participantAvatar}>
                                    {localParticipant.identity ? localParticipant.identity.substring(0, 2).toUpperCase() : 'ME'}
                                </div>
                                <div className={styles.participantName}>
                                    {localParticipant.identity} (You)
                                </div>
                            </div>
                        </div>
                        {/* Remote Participants Rows */}
                        {remoteParticipants.map((p) => (
                            <div className={styles.participantRow} key={p.sid || p.identity}>
                                <div className={styles.participantLeft}>
                                    <div className={styles.participantAvatar}>
                                        {p.identity ? p.identity.substring(0, 2).toUpperCase() : 'G'}
                                    </div>
                                    <div className={styles.participantName}>
                                        {p.identity}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bottom Controls Bar */}
            <div className={styles.buttonContainers}>
                <IconButton
                    onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
                    style={{ color: "white", padding: '10px' }}
                    className={isCameraEnabled ? styles.active : ''}
                >
                    {isCameraEnabled ? <VideocamIcon /> : <VideocamOffIcon style={{ color: '#EF4444' }} />}
                </IconButton>

                <IconButton
                    onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
                    style={{ color: "white", padding: '10px' }}
                    className={isMicrophoneEnabled ? styles.active : ''}
                >
                    {isMicrophoneEnabled ? <MicIcon /> : <MicOffIcon style={{ color: '#EF4444' }} />}
                </IconButton>

                {screenAvailable && (
                    <IconButton
                        onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
                        style={{ color: "white", padding: '10px' }}
                        className={isScreenShareEnabled ? styles.active : ''}
                    >
                        {isScreenShareEnabled ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                    </IconButton>
                )}

                <Badge badgeContent={unreadMessages > 0 ? unreadMessages : null} max={999} color='primary'>
                    <IconButton
                        onClick={toggleChat}
                        style={{ color: "white", padding: '10px' }}
                        className={showModal ? styles.active : ''}
                    >
                        <ChatIcon />
                    </IconButton>
                </Badge>

                <IconButton
                    onClick={toggleParticipants}
                    style={{ color: "white", padding: '10px' }}
                    className={showParticipants ? styles.active : ''}
                >
                    <PeopleIcon />
                </IconButton>

                <IconButton
                    onClick={handleEndCall}
                    style={{ padding: '10px' }}
                    className={styles.danger}
                >
                    <CallEndIcon />
                </IconButton>
            </div>

            {/* Grid Conference Videos Layout */}
            <div className={`${styles.conferenceView} ${styles[gridClass] || ''}`}>
                {/* Local Participant Card */}
                <div>
                    {isCameraEnabled || isScreenShareEnabled ? (
                        <VideoTrack
                            trackRef={{
                                participant: localParticipant,
                                source: isScreenShareEnabled ? 'screen_share' : 'camera'
                            }}
                            className={styles.meetUserVideo}
                            style={{ transform: isScreenShareEnabled ? 'none' : 'scaleX(-1)' }}
                        />
                    ) : (
                        <div className={styles.fallbackContainer}>
                            <div className={styles.avatarFallback}>
                                {localParticipant.identity ? localParticipant.identity.substring(0, 2).toUpperCase() : 'ME'}
                            </div>
                        </div>
                    )}
                    <div className={styles.participantLabel}>
                        You ({localParticipant.identity})
                        {!isMicrophoneEnabled && <MicOffIcon style={{ color: '#EF4444', fontSize: '0.9rem' }} />}
                    </div>
                </div>

                {/* Remote Participants Cards */}
                {remoteParticipants.map((p) => {
                    const hasCamera = p.isCameraEnabled;
                    const hasScreenShare = p.isScreenShareEnabled;
                    const hasMic = p.isMicrophoneEnabled;
                    return (
                        <div key={p.sid || p.identity}>
                            {hasCamera || hasScreenShare ? (
                                <VideoTrack
                                    trackRef={{
                                        participant: p,
                                        source: hasScreenShare ? 'screen_share' : 'camera'
                                    }}
                                    style={{ transform: 'none' }}
                                />
                            ) : (
                                <div className={styles.fallbackContainer}>
                                    <div className={styles.avatarFallback}>
                                        {p.identity ? p.identity.substring(0, 2).toUpperCase() : 'G'}
                                    </div>
                                </div>
                            )}
                            <div className={styles.participantLabel}>
                                {p.identity} {hasScreenShare && "(Screen)"}
                                {!hasMic && <MicOffIcon style={{ color: '#EF4444', fontSize: '0.9rem' }} />}
                            </div>
                        </div>
                    );
                })}
            </div>

            <Snackbar
                open={copySuccess}
                autoHideDuration={4000}
                onClose={() => setCopySuccess(false)}
                message="Meeting link copied to clipboard!"
            />
        </div>
    );
}

export default function LiveKitMeeting({
    token,
    serverUrl,
    onLeave
}) {
    const navigate = useNavigate();
    const [isDark, setIsDark] = useState(false);
    const [shouldConnect, setShouldConnect] = useState(true);
    const leaveHandledRef = useRef(false);
    const finalizedRef = useRef(false);

    // Load theme setting
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

    const theme = React.useMemo(() => createTheme({
        palette: {
            mode: isDark ? 'dark' : 'light',
            primary: {
                main: '#2563EB',
                dark: '#1D4ED8',
            },
            ...(isDark ? {} : {
                background: {
                    default: '#F8FAFC',
                    paper: '#FFFFFF',
                },
                text: {
                    primary: '#0F172A',
                    secondary: '#64748B',
                }
            })
        },
        typography: {
            fontFamily: "'Inter', sans-serif",
        },
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: '12px',
                        textTransform: 'none',
                        fontWeight: 600,
                        padding: '0.75rem 1rem',
                    }
                }
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        borderRadius: '12px',
                    }
                }
            }
        }
    }), [isDark]);

    const finalizeLeave = useCallback(() => {
        if (finalizedRef.current) return;
        finalizedRef.current = true;

        if (onLeave) {
            onLeave();
        } else {
            navigate("/home", { replace: true });
        }
    }, [navigate, onLeave]);

    // Single disconnect path: set connect=false so LiveKitRoom disconnects once,
    // unpublishes tracks, and fires onDisconnected before we navigate away.
    const requestDisconnect = useCallback(() => {
        if (leaveHandledRef.current) return;
        leaveHandledRef.current = true;
        setShouldConnect(false);
    }, []);

    const handleLeaveRequest = useCallback(() => {
        requestDisconnect();
    }, [requestDisconnect]);

    const handleDisconnected = useCallback(() => {
        if (!leaveHandledRef.current) {
            leaveHandledRef.current = true;
            setShouldConnect(false);
        }
        finalizeLeave();
    }, [finalizeLeave]);

    return (
        <ThemeProvider theme={theme}>
            <LiveKitRoom
                token={token}
                serverUrl={serverUrl}
                connect={shouldConnect}
                video={true}
                audio={true}
                options={{ disconnectOnPageLeave: true }}
                onDisconnected={handleDisconnected}
            >
                <CustomConferenceRoom onLeaveRequest={handleLeaveRequest} />
                <RoomAudioRenderer />
            </LiveKitRoom>
        </ThemeProvider>
    );
}