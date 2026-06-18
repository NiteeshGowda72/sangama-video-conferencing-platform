import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    RoomContext,
    RoomAudioRenderer,
    VideoTrack,
    useLocalParticipant,
    useRemoteParticipants,
    useRoomContext,
    useChat,
} from "@livekit/components-react";
import { ConnectionState, Room, RoomEvent } from "livekit-client";
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

function CustomConferenceRoom({ onLeaveRequest, isLeaving }) {
    const room = useRoomContext();
    const { localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant();
    const remoteParticipants = useRemoteParticipants();
    const { chatMessages, send } = useChat();

    const [showModal, setModal] = useState(false);
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

    useEffect(() => {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
            setScreenAvailable(true);
        }
    }, []);

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
        if (!isLeaving) {
            onLeaveRequest();
        }
    };

    const totalParticipants = 1 + remoteParticipants.length;
    const gridClass = totalParticipants <= 9 ? `participants-${totalParticipants}` : 'participants-9';

    return (
        <div className={styles.meetVideoContainer}>
            <div className={styles.meetingInfoBadge}>
                <div className={styles.meetingCodeBadge}>
                    Room: {room?.name || window.location.pathname.split('/').pop()}
                </div>
                <button className={styles.btnIconSm} title="Copy invitation link" onClick={copyMeetingCode}>
                    <ContentCopyIcon style={{ fontSize: '1rem' }} />
                </button>
                <div className={styles.meetingTimerBadge}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', marginRight: '0.25rem' }}></span>
                    {formatTime(timer)}
                </div>
            </div>

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

            {showParticipants && (
                <div className={styles.participantsRoom}>
                    <div className={styles.chatHeader}>
                        <h3>Participants ({totalParticipants})</h3>
                        <IconButton size="small" onClick={() => setShowParticipants(false)} style={{ color: 'white' }}>
                            <CloseIcon style={{ fontSize: '1.25rem' }} />
                        </IconButton>
                    </div>
                    <div className={styles.participantsList}>
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

            <div className={styles.buttonContainers}>
                <IconButton
                    onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
                    style={{ color: "white", padding: '10px' }}
                    className={isCameraEnabled ? styles.active : ''}
                    disabled={isLeaving}
                >
                    {isCameraEnabled ? <VideocamIcon /> : <VideocamOffIcon style={{ color: '#EF4444' }} />}
                </IconButton>

                <IconButton
                    onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
                    style={{ color: "white", padding: '10px' }}
                    className={isMicrophoneEnabled ? styles.active : ''}
                    disabled={isLeaving}
                >
                    {isMicrophoneEnabled ? <MicIcon /> : <MicOffIcon style={{ color: '#EF4444' }} />}
                </IconButton>

                {screenAvailable && (
                    <IconButton
                        onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
                        style={{ color: "white", padding: '10px' }}
                        className={isScreenShareEnabled ? styles.active : ''}
                        disabled={isLeaving}
                    >
                        {isScreenShareEnabled ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                    </IconButton>
                )}

                <Badge badgeContent={unreadMessages > 0 ? unreadMessages : null} max={999} color='primary'>
                    <IconButton
                        onClick={toggleChat}
                        style={{ color: "white", padding: '10px' }}
                        className={showModal ? styles.active : ''}
                        disabled={isLeaving}
                    >
                        <ChatIcon />
                    </IconButton>
                </Badge>

                <IconButton
                    onClick={toggleParticipants}
                    style={{ color: "white", padding: '10px' }}
                    className={showParticipants ? styles.active : ''}
                    disabled={isLeaving}
                >
                    <PeopleIcon />
                </IconButton>

                <IconButton
                    onClick={handleEndCall}
                    style={{ padding: '10px' }}
                    className={styles.danger}
                    disabled={isLeaving}
                >
                    <CallEndIcon />
                </IconButton>
            </div>

            <div className={`${styles.conferenceView} ${styles[gridClass] || ''}`}>
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
    onLeave,
}) {
    const [isDark, setIsDark] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [room, setRoom] = useState(null);

    const leaveRequestedRef = useRef(false);
    const onLeaveRef = useRef(onLeave);
    onLeaveRef.current = onLeave;

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

    const theme = useMemo(() => createTheme({
        palette: {
            mode: isDark ? 'dark' : 'light',
            primary: { main: '#2563EB', dark: '#1D4ED8' },
        },
        typography: { fontFamily: "'Inter', sans-serif" },
    }), [isDark]);

    const notifyLeaveComplete = useCallback(() => {
        if (onLeaveRef.current) {
            onLeaveRef.current();
        }
    }, []);

    useEffect(() => {
        if (!token || !serverUrl) return;

        const r = new Room({ disconnectOnPageLeave: false });
        setRoom(r);
        leaveRequestedRef.current = false;

        let cancelled = false;

        const onConnected = () => {};

        const onDisconnected = () => {
            if (leaveRequestedRef.current) {
                notifyLeaveComplete();
            }
        };

        r.on(RoomEvent.Connected, onConnected);
        r.on(RoomEvent.Disconnected, onDisconnected);

        const start = async () => {
            try {
                await r.connect(serverUrl, token, { autoSubscribe: true });
                if (cancelled) {
                    await r.disconnect();
                    return;
                }

                await Promise.all([
                    r.localParticipant.setMicrophoneEnabled(true),
                    r.localParticipant.setCameraEnabled(true),
                ]);
            } catch (err) {
                if (!cancelled) {
                    console.error("[LiveKit] Failed to connect or publish tracks:", err);
                }
            }
        };

        start();

        return () => {
            cancelled = true;
            r.off(RoomEvent.Connected, onConnected);
            r.off(RoomEvent.Disconnected, onDisconnected);

            r.disconnect().catch((err) => {
                console.error("[LiveKit] Cleanup disconnect failed:", err);
            });
        };
    }, [serverUrl, token, notifyLeaveComplete]);

    const requestLeave = useCallback(async () => {
        if (leaveRequestedRef.current || isLeaving || !room) return;

        leaveRequestedRef.current = true;
        setIsLeaving(true);

        try {
            if (room.state !== ConnectionState.Disconnected) {
                await room.disconnect();
            } else {
                notifyLeaveComplete();
            }
        } catch (err) {
            console.error("[LiveKit] Leave disconnect failed:", err);
            notifyLeaveComplete();
        }
    }, [room, isLeaving, notifyLeaveComplete]);

    if (!room) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: '#0B0F19',
                color: 'white',
                fontFamily: "'Inter', sans-serif"
            }}>
                <p style={{ fontSize: '1.1rem', fontWeight: 500, color: '#9CA3AF' }}>Preparing meeting room...</p>
            </div>
        );
    }

    return (
        <ThemeProvider theme={theme}>
            <RoomContext.Provider value={room}>
                <CustomConferenceRoom
                    onLeaveRequest={requestLeave}
                    isLeaving={isLeaving}
                />
                <RoomAudioRenderer room={room} />
            </RoomContext.Provider>
        </ThemeProvider>
    );
}
