import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import io from "socket.io-client";
import { Badge, IconButton, TextField, Button, Snackbar } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import PeopleIcon from '@mui/icons-material/People';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import server from '../environment';

const server_url = server;

// WebRTC ICE connection configuration - uses STUN server for NAT traversal
const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
        // For production, insert TURN servers here for relay through firewalls:
        // { "urls": "turn:turn.example.com:3478", "username": "username", "credential": "password" }
    ]
};

export default function VideoMeetComponent() {
    const navigate = useNavigate();

    // ============================================================================
    // SOCKET AND MEDIA STREAM REFERENCES
    // ============================================================================
    // These refs persist across re-renders and maintain the actual WebRTC state

    const socketRef = useRef(null);
    const socketIdRef = useRef(null);
    const localVideoref = useRef(null);

    // Main local media stream - kept alive throughout the meeting to prevent
    // automatic camera shutdown and ensure track state persistence
    const localStreamRef = useRef(null);

    // Backup of original video track when switching to screen sharing
    const originalVideoTrackRef = useRef(null);

    // ============================================================================
    // WEBRTC PEER CONNECTIONS MANAGEMENT
    // ============================================================================
    // Maps socket ID -> RTCPeerConnection. Maintained as a single source of truth
    // to prevent duplicate peer connections and ensure stable connections.

    const connectionsRef = useRef({});

    // Tracks which ICE candidates are queued while remote description is pending
    // This prevents errors when candidates arrive before SDP
    const queuedCandidatesRef = useRef({});

    // Track received RTCTrackEvents to prevent duplicate ontrack handler calls
    // from creating multiple participant tiles (a common bug in WebRTC apps)
    // Maps: `${peerId}:${track.id}` -> true
    const seenTracksRef = useRef({});

    // ============================================================================
    // DEVICE AVAILABILITY FLAGS
    // ============================================================================
    const [videoAvailable, setVideoAvailable] = useState(true);
    const [audioAvailable, setAudioAvailable] = useState(true);
    const [screenAvailable, setScreenAvailable] = useState(false);

    // ============================================================================
    // MEDIA CONTROL TOGGLES
    // ============================================================================
    // These control the enabled state of local tracks, not track replacement.
    // Using track.enabled instead of stopping/recreating tracks provides:
    // - Instant feedback to remote peers
    // - Stable connection state
    // - No flickering or reconnection delays

    const [videoEnabled, setVideoEnabled] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [screenSharing, setScreenSharing] = useState(false);

    // ============================================================================
    // USER AND LOBBY MANAGEMENT
    // ============================================================================
    const [askForUsername, setAskForUsername] = useState(true);
    const [username, setUsername] = useState("");

    // Array of remote video participants. Each has socketId as the unique key
    // to ensure exactly one tile per remote user.
    const [videos, setVideos] = useState([]);

    // ============================================================================
    // UI STATE (CHAT, PARTICIPANTS, THEME, TIMER)
    // ============================================================================
    const [showModal, setModal] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [newMessages, setNewMessages] = useState(0);
    const [isDark, setIsDark] = useState(false);
    const [timer, setTimer] = useState(0);

    // Ref to track modal open state for use in socket event closure
    const showModalRef = useRef(showModal);
    useEffect(() => {
        showModalRef.current = showModal;
    }, [showModal]);

    // ============================================================================
    // THEME AND UI SETUP
    // ============================================================================
    // Theme persistence across page reloads for improved UX
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

    // ============================================================================
    // SESSION TIMER (displayed in meeting info badge)
    // ============================================================================
    useEffect(() => {
        let interval;
        if (!askForUsername) {
            interval = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [askForUsername]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    // ============================================================================
    // LOCAL VIDEO ELEMENT REFERENCE MANAGEMENT
    // ============================================================================
    // This callback safely attaches the local media stream to the video element
    // whenever it mounts or updates, without recreating the stream unnecessarily.
    const setLocalVideoRef = (el) => {
        localVideoref.current = el;
        if (el && localStreamRef.current) {
            el.srcObject = localStreamRef.current;
        }
    };

    // ============================================================================
    // FALLBACK MEDIA TRACK GENERATION
    // ============================================================================
    // These functions create silent audio and black video tracks as fallbacks
    // when camera/microphone are unavailable (e.g., in development or denied).
    // These fallbacks prevent the connection from breaking due to missing streams.

    const createSilentAudioTrack = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = ctx.createOscillator();
            const dst = oscillator.connect(ctx.createMediaStreamDestination());
            oscillator.start();
            ctx.resume();
            const track = dst.stream.getAudioTracks()[0];
            track.enabled = false;
            return track;
        } catch (e) {
            console.error("[Media] Failed to create fallback silent audio track:", e);
            return null;
        }
    };

    const createBlackVideoTrack = ({ width = 640, height = 480 } = {}) => {
        try {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, width, height);
            const stream = canvas.captureStream();
            const track = stream.getVideoTracks()[0];
            track.enabled = false;
            return track;
        } catch (e) {
            console.error("[Media] Failed to create fallback black video track:", e);
            return null;
        }
    };

    // ============================================================================
    // INITIAL MEDIA PERMISSIONS AND STREAM SETUP
    // ============================================================================
    // This function:
    // 1. Checks device availability (camera, microphone, screen share)
    // 2. Requests permissions early to catch denials before connecting
    // 3. Creates the local media stream that will be reused throughout the meeting
    // 4. Falls back to synthetic tracks if real media is unavailable
    //
    // KEY: The stream created here is kept alive for the entire meeting duration.
    // Tracks are enabled/disabled via track.enabled, never stopped/recreated.

    const getPermissionsAndInitMedia = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn("[Media] Camera and microphone require HTTPS or localhost. Using fallback silent/black tracks.");
            setVideoAvailable(false);
            setAudioAvailable(false);

            const fallbackStream = new MediaStream();
            const blackVideo = createBlackVideoTrack();
            const silentAudio = createSilentAudioTrack();
            if (blackVideo) fallbackStream.addTrack(blackVideo);
            if (silentAudio) fallbackStream.addTrack(silentAudio);

            localStreamRef.current = fallbackStream;
            if (localVideoref.current) {
                localVideoref.current.srcObject = fallbackStream;
            }
            return;
        }

        let hasVideo = false;
        let hasAudio = false;

        // Test camera availability by requesting and immediately stopping
        try {
            const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
            vStream.getTracks().forEach(t => t.stop());
            setVideoAvailable(true);
            hasVideo = true;
        } catch (err) {
            console.warn("[Media] Camera access denied or unavailable:", err);
            setVideoAvailable(false);
        }

        // Test microphone availability by requesting and immediately stopping
        try {
            const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            aStream.getTracks().forEach(t => t.stop());
            setAudioAvailable(true);
            hasAudio = true;
        } catch (err) {
            console.warn("[Media] Microphone access denied or unavailable:", err);
            setAudioAvailable(false);
        }

        // Check for screen sharing capability
        if (navigator.mediaDevices.getDisplayMedia) {
            setScreenAvailable(true);
        } else {
            setScreenAvailable(false);
        }

        // NOW create the persistent local stream with actual or fallback tracks
        try {
            const tracks = [];

            if (hasVideo) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) tracks.push(videoTrack);
            } else {
                const blackVideo = createBlackVideoTrack();
                if (blackVideo) tracks.push(blackVideo);
            }

            if (hasAudio) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const audioTrack = stream.getAudioTracks()[0];
                if (audioTrack) tracks.push(audioTrack);
            } else {
                const silentAudio = createSilentAudioTrack();
                if (silentAudio) tracks.push(silentAudio);
            }

            const mediaStream = new MediaStream(tracks);
            localStreamRef.current = mediaStream;
            if (localVideoref.current) {
                localVideoref.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error("[Media] Error setting up local media stream:", err);
            const fallbackStream = new MediaStream();
            const blackVideo = createBlackVideoTrack();
            const silentAudio = createSilentAudioTrack();
            if (blackVideo) fallbackStream.addTrack(blackVideo);
            if (silentAudio) fallbackStream.addTrack(silentAudio);
            localStreamRef.current = fallbackStream;
            if (localVideoref.current) {
                localVideoref.current.srcObject = fallbackStream;
            }
        }
    };

    // ============================================================================
    // COMPONENT MOUNT/UNMOUNT LIFECYCLE
    // ============================================================================
    // On mount: initialize media permissions early
    // On unmount: CRITICAL cleanup to prevent resource leaks and reconnection issues
    //
    // This effect properly closes all peer connections, stops all tracks, and
    // disconnects the socket. Failure to do this causes:
    // - Browser resource leaks
    // - Failed reconnections
    // - Duplicate participants on refresh
    // - Audio/video devices staying locked in other apps

    useEffect(() => {
        getPermissionsAndInitMedia();

        // Capture references to clean up (using stable copies to avoid ESLint warnings)
        const currentConnections = connectionsRef.current;
        const currentSocket = socketRef.current;

        return () => {
            console.log("[Cleanup] Component unmounting. Closing all connections and tracks.");

            // Step 1: Stop all local media tracks to release device locks
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => {
                    track.stop();
                });
                localStreamRef.current = null;
            }

            // Step 2: Properly close all peer connections with event handler cleanup
            // (this prevents orphaned connections from firing events)
            if (currentConnections) {
                Object.keys(currentConnections).forEach(peerId => {
                    const pc = currentConnections[peerId];
                    if (pc) {
                        // Remove all event handlers first to prevent closure issues
                        pc.ontrack = null;
                        pc.onicecandidate = null;
                        pc.oniceconnectionstatechange = null;
                        pc.onconnectionstatechange = null;
                        pc.ondatachannel = null;
                        pc.onnegotiationneeded = null;

                        try {
                            pc.close();
                        } catch (e) {
                            console.error("[Cleanup] Error closing peer connection during unmount:", e);
                        }
                    }
                });
                connectionsRef.current = {};
            }

            // Step 3: Clear queued candidates and seen tracks
            queuedCandidatesRef.current = {};
            seenTracksRef.current = {};

            // Step 4: Disconnect socket and remove all listeners
            if (currentSocket) {
                // Defensive removal of all known listeners
                currentSocket.off('connect');
                currentSocket.off('signal');
                currentSocket.off('chat-message');
                currentSocket.off('user-left');
                currentSocket.off('user-joined');
                currentSocket.off('disconnect');
                currentSocket.off('connect_error');
                currentSocket.disconnect();
                socketRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);



    // ============================================================================
    // WEBRTC PEER CONNECTION LIFECYCLE
    // ============================================================================
    // KEY REQUIREMENT: Exactly one RTCPeerConnection per socket ID
    // This prevents:
    // - Duplicate offers/answers
    // - Multiple data streams from same peer
    // - Connection resource exhaustion
    // - Signaling state corruption

    const getOrCreateConnection = (peerId) => {
        // Return existing connection if already established
        if (connectionsRef.current[peerId]) {
            console.log(`[WebRTC] Peer connection REUSED for peerId: ${peerId}`);
            return connectionsRef.current[peerId];
        }

        console.log(`[WebRTC] Creating new peer connection for peerId: ${peerId}`);
        const pc = new RTCPeerConnection(peerConfigConnections);
        connectionsRef.current[peerId] = pc;

        // ========================================================================
        // ICE CANDIDATE HANDLER
        // ========================================================================
        // Sends local ICE candidates to the remote peer via signaling channel.
        // ICE candidates represent possible network paths to reach this peer.
        pc.onicecandidate = (event) => {
            if (event.candidate && socketRef.current) {
                // Emit the candidate to remote peer
                socketRef.current.emit('signal', peerId, JSON.stringify({ ice: event.candidate }));
            }
        };

        // ========================================================================
        // REMOTE TRACK HANDLER
        // ========================================================================
        // Fired when remote peer sends a media track (audio or video).
        // CRITICAL: Use seenTracksRef to prevent duplicate ontrack events from
        // creating multiple participant tiles for the same person.
        pc.ontrack = (event) => {
            const trackId = event.track.id;
            const trackKey = `${peerId}:${trackId}`;

            console.log(
                `[WebRTC] Received remote track from ${peerId}: kind=${event.track.kind}, id=${trackId}`
            );

            // Prevent duplicate track events (common cause of duplicate participants)
            if (seenTracksRef.current[trackKey]) {
                console.warn(
                    `[WebRTC] Duplicate ontrack event ignored for ${peerId}:${trackId}`
                );
                return;
            }

            // Mark track as seen
            seenTracksRef.current[trackKey] = true;

            // Only update state if we got a valid stream
            const remoteStream = event.streams[0];
            if (!remoteStream) {
                console.warn(`[WebRTC] Received ontrack event without stream for ${peerId}`);
                return;
            }

            // Add or update participant in video list
            // Use filter to ensure no duplicate socketId entries
            setVideos(prevVideos => {
                const cleanVideos = prevVideos.filter(v => v.socketId !== peerId);
                console.log(`[WebRTC] Adding remote video tile for ${peerId}`);
                return [...cleanVideos, {
                    socketId: peerId,
                    stream: remoteStream,
                    autoplay: true,
                    playsinline: true
                }];
            });
        };

        // ========================================================================
        // ICE CONNECTION STATE HANDLER
        // ========================================================================
        // Monitors the connection status of ICE layer.
        // States: new, checking, connected, completed, failed, disconnected, closed
        pc.oniceconnectionstatechange = () => {
            console.log(
                `[WebRTC] ICE connection state changed: ${peerId} -> ${pc.iceConnectionState}`
            );

            // Handle connection failures and closures
            if (
                pc.iceConnectionState === 'failed' ||
                pc.iceConnectionState === 'closed' ||
                pc.iceConnectionState === 'disconnected'
            ) {
                console.warn(`[WebRTC] ICE connection failed/closed for ${peerId}. Cleaning up.`);
                handlePeerDisconnect(peerId);
            }
        };

        // ========================================================================
        // OVERALL CONNECTION STATE HANDLER
        // ========================================================================
        // Monitors the high-level connection state (separate from ICE).
        // States: new, connecting, connected, disconnected, failed, closed
        pc.onconnectionstatechange = () => {
            console.log(
                `[WebRTC] Connection state changed: ${peerId} -> ${pc.connectionState}`
            );

            // Handle failures and closures
            if (
                pc.connectionState === 'failed' ||
                pc.connectionState === 'closed'
            ) {
                console.warn(`[WebRTC] Connection state failed/closed for ${peerId}. Cleaning up.`);
                handlePeerDisconnect(peerId);
            }
        };

        // ========================================================================
        // ADD LOCAL TRACKS TO PEER CONNECTION
        // ========================================================================
        // Essential: Add local stream tracks BEFORE any signaling occurs.
        // This ensures remote peer receives our audio/video when they answer.
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current);
            });
            console.log(
                `[WebRTC] Added ${localStreamRef.current.getTracks().length} local tracks to connection for ${peerId}`
            );
        }

        return pc;
    };

    // ============================================================================
    // PEER DISCONNECTION AND CLEANUP
    // ============================================================================
    // Called when a remote peer leaves or connection fails.
    // CRITICAL: Properly clean up connection objects to prevent resource leaks
    // and orphaned event handlers that continue firing after peer is gone.

    const handlePeerDisconnect = (peerId) => {
        console.log(`[WebRTC] Cleaning up peer connection for ${peerId}`);

        const pc = connectionsRef.current[peerId];
        if (pc) {
            // Null out all event handlers FIRST to prevent any pending handlers
            // from being called after connection is closed
            pc.ontrack = null;
            pc.onicecandidate = null;
            pc.oniceconnectionstatechange = null;
            pc.onconnectionstatechange = null;
            pc.ondatachannel = null;
            pc.onnegotiationneeded = null;

            try {
                pc.close();
            } catch (e) {
                console.error("[WebRTC] Error closing peer connection during disconnect:", e);
            }

            delete connectionsRef.current[peerId];
        }

        // Clean up queued ICE candidates for this peer
        delete queuedCandidatesRef.current[peerId];

        // Clean up seen tracks for this peer
        Object.keys(seenTracksRef.current).forEach(key => {
            if (key.startsWith(peerId + ':')) {
                delete seenTracksRef.current[key];
            }
        });

        // Remove from video list state
        setVideos(prevVideos => {
            const filtered = prevVideos.filter(v => v.socketId !== peerId);
            console.log(`[WebRTC] Removed remote video tile for ${peerId}. Remaining: ${filtered.length}`);
            return filtered;
        });
    };

    // ============================================================================
    // SIGNALING MESSAGE HANDLER (SDP & ICE)
    // ============================================================================
    // Processes incoming SDP offers/answers and ICE candidates from remote peers.
    // The complexity here is managing the signaling state to prevent:
    // - Duplicate offers causing connection to hang
    // - Duplicate answers in wrong state
    // - Race conditions when offers arrive simultaneously
    //
    // Signaling states: stable -> have-local-offer -> have-remote-offer -> stable
    //                        -> have-local-offer -> have-remote-answer -> stable

    const gotMessageFromServer = async (fromId, message) => {
        // Ignore messages from ourselves
        if (fromId === socketIdRef.current) return;

        try {
            const signal = JSON.parse(message);
            const pc = getOrCreateConnection(fromId);

            // ====================================================================
            // HANDLE SDP MESSAGES (offer/answer)
            // ====================================================================
            if (signal.sdp) {
                const desc = new RTCSessionDescription(signal.sdp);

                // DEFENSIVE CHECK: Ignore offers if signaling state is not stable
                // This prevents state corruption from simultaneous offers
                if (desc.type === 'offer') {
                    if (pc.signalingState !== 'stable') {
                        console.warn(
                            `[WebRTC] Ignoring duplicate offer from ${fromId} ` +
                            `(signalingState=${pc.signalingState}, must be 'stable')`
                        );
                        return;
                    }
                }

                // DEFENSIVE CHECK: Ignore answers if not waiting for answer
                if (desc.type === 'answer') {
                    if (pc.signalingState !== 'have-local-offer') {
                        console.warn(
                            `[WebRTC] Ignoring duplicate answer from ${fromId} ` +
                            `(signalingState=${pc.signalingState}, must be 'have-local-offer')`
                        );
                        return;
                    }
                }

                // Apply remote description (safe now that we've checked state)
                try {
                    await pc.setRemoteDescription(desc);
                    console.log(`[WebRTC] Remote description set: ${desc.type} from ${fromId}`);
                } catch (e) {
                    console.error(`[WebRTC] Error setting remote description from ${fromId}:`, e);
                    return;
                }

                // ANSWER PHASE: If we received an offer, create and send an answer
                if (desc.type === 'offer') {
                    try {
                        console.log(`[WebRTC] Creating answer to offer from ${fromId}`);
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);

                        if (socketRef.current) {
                            socketRef.current.emit(
                                'signal',
                                fromId,
                                JSON.stringify({ sdp: pc.localDescription })
                            );
                        }
                    } catch (e) {
                        console.error(`[WebRTC] Error creating/sending answer to ${fromId}:`, e);
                    }
                }

                // PROCESS BACKLOG: Apply any ICE candidates that arrived before SDP
                const queued = queuedCandidatesRef.current[fromId] || [];
                console.log(`[WebRTC] Processing ${queued.length} queued ICE candidates for ${fromId}`);

                for (const candidateData of queued) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidateData));
                    } catch (e) {
                        console.error(
                            `[WebRTC] Error adding queued ICE candidate from ${fromId}:`,
                            e
                        );
                    }
                }
                queuedCandidatesRef.current[fromId] = [];
            }

            // ====================================================================
            // HANDLE ICE CANDIDATE MESSAGES
            // ====================================================================
            if (signal.ice) {
                const candidate = new RTCIceCandidate(signal.ice);

                // Only add ICE candidate if remote description is set
                // (candidates must come after SDP for WebRTC state machine)
                if (pc.remoteDescription && pc.remoteDescription.type) {
                    try {
                        await pc.addIceCandidate(candidate);
                        console.log(`[WebRTC] ICE candidate added from ${fromId}`);
                    } catch (e) {
                        console.error(
                            `[WebRTC] Error adding ICE candidate from ${fromId}:`,
                            e
                        );
                    }
                } else {
                    // Queue candidate until remote description arrives
                    if (!queuedCandidatesRef.current[fromId]) {
                        queuedCandidatesRef.current[fromId] = [];
                    }
                    queuedCandidatesRef.current[fromId].push(signal.ice);
                    console.log(
                        `[WebRTC] ICE candidate queued for ${fromId} ` +
                        `(remote description not set yet)`
                    );
                }
            }
        } catch (err) {
            console.error(`[WebRTC] Error processing signal from ${fromId}:`, err);
        }
    };

    // ============================================================================
    // SOCKET.IO CONNECTION AND SIGNALING
    // ============================================================================
    // Establishes Socket.IO connection to signaling server.
    // Handles room joining and peer discovery.
    //
    // KEY: Socket listeners are registered ONCE and NOT removed/re-added on
    // reconnects. This prevents:
    // - Duplicate event handlers firing multiple times
    // - Memory leaks from orphaned listeners
    // - Race conditions in user-joined logic

    const connectToSocketServer = () => {
        // Prevent creating multiple socket connections
        if (socketRef.current) {
            console.log("[Socket] Socket connection already initialized.");
            return;
        }

        console.log("[Socket] Initializing Socket.IO connection...");
        const socket = io(server_url, {
            transports: ["websocket", "polling"]
        });
        socketRef.current = socket;

        // ====================================================================
        // CONNECTION EVENT
        // ====================================================================
        // Fired when socket first connects or reconnects.
        socket.on('connect', () => {
            console.log("[Socket] Connected to server");

            // RECONNECT DETECTION: Check if socket ID changed (indicates reconnect)
            if (socketIdRef.current && socketIdRef.current !== socket.id) {
                console.warn(
                    "[Socket] Reconnect detected! Old socket ID: " +
                    `${socketIdRef.current}, New socket ID: ${socket.id}`
                );

                // CRITICAL: On reconnect, close all peer connections and clear state
                // This prevents stale connections from trying to send to old socket IDs
                console.log("[Socket] Cleaning up all peer connections due to reconnect...");
                Object.keys(connectionsRef.current).forEach(peerId => {
                    handlePeerDisconnect(peerId);
                });
                setVideos([]);
            }

            socketIdRef.current = socket.id;
            console.log(`[Socket] Joined server with socket ID: ${socket.id}`);

            // Join the meeting room (identified by URL pathname)
            const roomId = window.location.pathname;
            console.log(`[Socket] Joining room: ${roomId}`);
            socket.emit('join-call', roomId);
        });

        // ====================================================================
        // DISCONNECT EVENT
        // ====================================================================
        socket.on('disconnect', (reason) => {
            console.log(`[Socket] Disconnected from server. Reason: ${reason}`);
        });

        // ====================================================================
        // CONNECTION ERROR EVENT
        // ====================================================================
        socket.on('connect_error', (error) => {
            console.error("[Socket] Connection error:", error);
        });

        // ====================================================================
        // SIGNAL MESSAGE EVENT
        // ====================================================================
        // Receives SDP offers/answers and ICE candidates from remote peers.
        socket.on('signal', (fromId, message) => {
            console.log(`[Socket] Received signal from ${fromId}`);
            gotMessageFromServer(fromId, message);
        });

        // ====================================================================
        // CHAT MESSAGE EVENT
        // ====================================================================
        socket.on('chat-message', (message, sender, socketIdSender) => {
            console.log(`[Socket] Chat message from ${sender}: ${message}`);
            addMessage(message, sender, socketIdSender);
        });

        // ====================================================================
        // USER LEFT EVENT
        // ====================================================================
        // Fired when a remote peer leaves the meeting.
        socket.on('user-left', (leftSocketId) => {
            console.log(`[Socket] User left: ${leftSocketId}`);
            handlePeerDisconnect(leftSocketId);
        });

        // ====================================================================
        // USER JOINED EVENT
        // ====================================================================
        // Fired when a new user joins the meeting.
        // Parameters:
        //   - id: The socket ID of the newly joined user
        //   - clients: Array of ALL socket IDs currently in the room
        //
        // Logic:
        //   1. If WE just joined (id === socketIdRef.current):
        //      - Create connections to all existing peers
        //      - Send offers to all existing peers (we're the joiner)
        //   2. If SOMEONE ELSE joined:
        //      - Create connection to them (they will send offer to us)
        socket.on('user-joined', (id, clients) => {
            console.log(
                `[Socket] User joined: ${id}. All clients in room: ${clients.join(', ')}`
            );

            // Step 1: Pre-create connections for all known peers
            // This avoids race conditions where getOrCreateConnection is called
            // from multiple paths simultaneously
            clients.forEach((socketListId) => {
                if (socketListId === socketIdRef.current) return; // Skip ourselves
                getOrCreateConnection(socketListId);
            });

            // Step 2: If WE are the newly joined user, send offers to all existing peers
            if (id === socketIdRef.current) {
                console.log(
                    "[WebRTC] We joined the room. Sending offers to " +
                    `${clients.length - 1} existing peers...`
                );

                clients.forEach((socketListId) => {
                    if (socketListId === socketIdRef.current) return; // Skip ourselves

                    const pc = connectionsRef.current[socketListId];
                    if (!pc) {
                        console.warn(
                            `[WebRTC] Peer connection should exist for ${socketListId} ` +
                            "but doesn't. Creating..."
                        );
                        getOrCreateConnection(socketListId);
                        return;
                    }

                    // DEFENSIVE CHECK: Only create offer if signaling state is stable
                    if (pc.signalingState !== 'stable') {
                        console.warn(
                            `[WebRTC] Skipping offer to ${socketListId} ` +
                            `(signalingState=${pc.signalingState}, not stable)`
                        );
                        return;
                    }

                    // Create and send offer
                    pc.createOffer()
                        .then((description) => {
                            console.log(`[WebRTC] Created offer for ${socketListId}`);
                            return pc.setLocalDescription(description);
                        })
                        .then(() => {
                            if (socketRef.current) {
                                socketRef.current.emit(
                                    'signal',
                                    socketListId,
                                    JSON.stringify({ sdp: pc.localDescription })
                                );
                                console.log(`[WebRTC] Sent offer to ${socketListId}`);
                            }
                        })
                        .catch(e => {
                            console.error(
                                `[WebRTC] Error creating offer to ${socketListId}:`,
                                e
                            );
                        });
                });
            }
        });
    };


    // ============================================================================
    // MEDIA CONTROL HANDLERS
    // ============================================================================
    // These handlers manage camera, microphone, and screen sharing.
    //
    // KEY PRINCIPLE: Use track.enabled for toggles, NOT replaceTrack or stop.
    // Why? Because:
    // - track.enabled is instant - remote peers see change immediately
    // - No reconnection delays or video blinking
    // - Connection state stays stable
    // - Camera/mic stays "reserved" by browser, preventing other apps from using it
    //
    // replaceTrack is only used when actually swapping to a different source
    // (e.g., camera -> screen share, screen share -> camera).

    const handleVideoToggle = async () => {
        if (!localStreamRef.current) {
            console.warn("[Media] Cannot toggle video: no local stream");
            return;
        }

        const nextVideoState = !videoEnabled;
        console.log(`[Media] Video toggle: ${videoEnabled} -> ${nextVideoState}`);

        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (!currentVideoTrack) {
            console.warn("[Media] No video track found in local stream");
            return;
        }

        // INSTANT: Just toggle the enabled flag
        // Remote peers will immediately see the change
        currentVideoTrack.enabled = nextVideoState;
        setVideoEnabled(nextVideoState);

        console.log(`[Media] Video track enabled set to: ${nextVideoState}`);
    };

    const handleAudioToggle = () => {
        if (!localStreamRef.current) {
            console.warn("[Media] Cannot toggle audio: no local stream");
            return;
        }

        const nextAudioState = !audioEnabled;
        console.log(`[Media] Audio toggle: ${audioEnabled} -> ${nextAudioState}`);

        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (!audioTrack) {
            console.warn("[Media] No audio track found in local stream");
            return;
        }

        // INSTANT: Just toggle the enabled flag
        audioTrack.enabled = nextAudioState;
        setAudioEnabled(nextAudioState);

        console.log(`[Media] Audio track enabled set to: ${nextAudioState}`);
    };

    // ============================================================================
    // SCREEN SHARING
    // ============================================================================
    // This is the one case where we DO use replaceTrack, because we're switching
    // from camera to screen capture source (or vice versa).
    //
    // Flow:
    //   1. Save current video track
    //   2. Get display media (screen)
    //   3. Replace track on all peer connections
    //   4. Set flag and wait for user to stop sharing
    //   5. Restore original camera track

    const handleScreenToggle = async () => {
        if (!localStreamRef.current) {
            console.warn("[ScreenShare] Cannot share screen: no local stream");
            return;
        }

        if (!screenSharing) {
            // START SCREEN SHARING
            try {
                console.log("[ScreenShare] Starting screen share...");

                // Get display media (user chooses which screen/window to share)
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false  // Don't capture system audio, keep user's mic
                });

                const screenTrack = screenStream.getVideoTracks()[0];
                if (!screenTrack) {
                    console.warn("[ScreenShare] No screen track returned");
                    return;
                }

                // SAVE current camera track so we can restore it later
                const cameraTrack = localStreamRef.current.getVideoTracks()[0];
                originalVideoTrackRef.current = cameraTrack;

                console.log("[ScreenShare] Saved camera track for later restoration");

                // Replace camera track with screen track
                if (cameraTrack) {
                    localStreamRef.current.removeTrack(cameraTrack);
                }
                localStreamRef.current.addTrack(screenTrack);

                // Update local video element to show screen
                if (localVideoref.current) {
                    localVideoref.current.srcObject = localStreamRef.current;
                }

                // Replace track on all peer connections
                // This tells remote peers "I'm now sending screen instead of camera"
                Object.values(connectionsRef.current).forEach((pc, index) => {
                    if (pc.connectionState === 'connected' || pc.connectionState === 'connecting') {
                        const videoSender = pc.getSenders().find(
                            s => s.track && s.track.kind === 'video'
                        );
                        if (videoSender) {
                            videoSender.replaceTrack(screenTrack).catch(err => {
                                console.error(
                                    "[ScreenShare] Error replacing track on peer connection:",
                                    err
                                );
                            });
                        }
                    }
                });

                setScreenSharing(true);
                console.log("[ScreenShare] Screen sharing started");

                // Handle user clicking "Stop Sharing" in browser UI
                // (not just our button, but the native browser stop button)
                screenTrack.onended = () => {
                    console.log("[ScreenShare] User clicked browser stop button");
                    stopScreenSharing();
                };
            } catch (err) {
                console.error("[ScreenShare] Failed to start screen share:", err);
                // User likely clicked cancel in the share dialog
            }
        } else {
            // STOP SCREEN SHARING
            stopScreenSharing();
        }
    };

    const stopScreenSharing = async () => {
        console.log("[ScreenShare] Stopping screen share...");

        if (!localStreamRef.current) {
            console.warn("[ScreenShare] No local stream to restore");
            return;
        }

        setScreenSharing(false);

        // Get current screen track and stop it
        const screenTrack = localStreamRef.current.getVideoTracks()[0];
        if (screenTrack) {
            screenTrack.stop();
            localStreamRef.current.removeTrack(screenTrack);
        }

        // Determine what to restore
        let restoreTrack = originalVideoTrackRef.current;

        // Check if saved camera track is still valid
        if (!restoreTrack || restoreTrack.readyState === 'ended') {
            console.log("[ScreenShare] Camera track no longer valid, requesting new one...");

            // Attempt to get fresh camera track
            if (videoEnabled && videoAvailable) {
                try {
                    const tempStream = await navigator.mediaDevices.getUserMedia({
                        video: true
                    });
                    restoreTrack = tempStream.getVideoTracks()[0];
                    console.log("[ScreenShare] Got fresh camera track");
                } catch (err) {
                    console.error("[ScreenShare] Failed to get fresh camera track:", err);
                    restoreTrack = createBlackVideoTrack();
                }
            } else {
                // Video disabled or unavailable, use black track
                restoreTrack = createBlackVideoTrack();
            }
        }

        if (!restoreTrack) {
            console.error("[ScreenShare] Could not get any video track to restore");
            return;
        }

        // Add camera track back to local stream
        localStreamRef.current.addTrack(restoreTrack);

        // Update local video element
        if (localVideoref.current) {
            localVideoref.current.srcObject = localStreamRef.current;
        }

        // Replace track on all peer connections
        Object.values(connectionsRef.current).forEach((pc) => {
            if (pc.connectionState === 'connected' || pc.connectionState === 'connecting') {
                const videoSender = pc.getSenders().find(
                    s => s.track && s.track.kind === 'video'
                );
                if (videoSender) {
                    videoSender.replaceTrack(restoreTrack).catch(err => {
                        console.error(
                            "[ScreenShare] Error replacing track back to camera:",
                            err
                        );
                    });
                }
            }
        });

        // Clear the saved reference
        originalVideoTrackRef.current = null;
        console.log("[ScreenShare] Restored camera, screen share stopped");
    };

    // ============================================================================
    // END CALL HANDLER
    // ============================================================================
    // Gracefully leaves the meeting:
    // 1. Stops all local media tracks (release camera/mic)
    // 2. Closes all peer connections
    // 3. Disconnects from signaling socket
    // 4. Navigates back to home/landing page
    //
    // This prevents resource leaks and ensures a clean state if the user
    // refreshes or rejoins later.

    const handleEndCall = () => {
        console.log("[Meeting] Ending call...");

        // Stop all local tracks immediately
        if (localStreamRef.current) {
            console.log("[Meeting] Stopping all local media tracks");
            localStreamRef.current.getTracks().forEach(track => {
                track.stop();
            });
            localStreamRef.current = null;
        }

        // Close all peer connections
        console.log("[Meeting] Closing all peer connections");
        Object.keys(connectionsRef.current).forEach(peerId => {
            handlePeerDisconnect(peerId);
        });

        // Disconnect from signaling server
        if (socketRef.current) {
            console.log("[Meeting] Disconnecting from socket server");
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        console.log("[Meeting] Call ended successfully");

        // Navigate back to home/landing
        if (localStorage.getItem("token")) {
            window.location.href = "/home";
        } else {
            window.location.href = "/";
        }
    };

    // ============================================================================
    // CHAT AND PARTICIPANTS MANAGEMENT
    // ============================================================================

    const copyMeetingCode = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopySuccess(true);
        console.log("[UI] Meeting link copied to clipboard");
    };

    const toggleChat = () => {
        setModal(prev => {
            const next = !prev;
            if (next) setShowParticipants(false); // Close participants panel if opening chat
            return next;
        });
        setNewMessages(0);
    };

    const toggleParticipants = () => {
        setShowParticipants(prev => {
            const next = !prev;
            if (next) setModal(false); // Close chat panel if opening participants
            return next;
        });
    };

    const closeChat = () => {
        setModal(false);
    };

    const handleMessage = (e) => {
        setMessage(e.target.value);
    };

    const addMessage = (data, sender, socketIdSender) => {
        setMessages((prevMessages) => [
            ...prevMessages,
            { sender: sender, data: data }
        ]);
        // Only increment unread count if message is from someone else and chat is closed
        if (socketIdSender !== socketIdRef.current && !showModalRef.current) {
            setNewMessages((prevNewMessages) => prevNewMessages + 1);
        }
    };

    const sendMessage = () => {
        if (!message.trim()) return;
        if (socketRef.current) {
            socketRef.current.emit('chat-message', message, username);
        }
        setMessage("");
    };

    // ============================================================================
    // LOBBY/MEETING INITIALIZATION
    // ============================================================================

    const connect = () => {
        if (!username.trim()) {
            alert("Please enter a username before connecting.");
            return;
        }
        console.log(`[Meeting] User "${username}" connecting to room...`);
        setAskForUsername(false);
        connectToSocketServer();
    };

    return (
        <ThemeProvider theme={theme}>
            <div>
                {askForUsername === true ?
                    <div className="lobbyContainer">
                        <div className="lobbyCard">
                            {/* Camera Preview on Left */}
                            <div className="lobbyPreview">
                                <div className="lobbyPreviewTitle">Green Room Preview</div>
                                <div className="videoFrame">
                                    <video ref={setLocalVideoRef} autoPlay muted></video>
                                    <div className="videoOverlay">
                                        {videoAvailable ? "Video stream online" : "Connecting camera..."}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                                    <Button
                                        variant="outlined"
                                        color={videoAvailable ? "primary" : "error"}
                                        startIcon={videoAvailable ? <VideocamIcon /> : <VideocamOffIcon />}
                                        style={{ borderRadius: '12px', textTransform: 'none' }}
                                        disabled
                                    >
                                        {videoAvailable ? "Camera Active" : "No Camera"}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color={audioAvailable ? "success" : "error"}
                                        startIcon={audioAvailable ? <MicIcon /> : <MicOffIcon />}
                                        style={{ borderRadius: '12px', textTransform: 'none' }}
                                        disabled
                                    >
                                        {audioAvailable ? "Microphone Active" : "No Mic"}
                                    </Button>
                                </div>
                            </div>

                            {/* Join Controls on Right */}
                            <div className="lobbyForm">
                                <div
                                    className="btn-back-home"
                                    onClick={() => {
                                        if (localStorage.getItem("token")) {
                                            navigate("/home");
                                        } else {
                                            navigate("/");
                                        }
                                    }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', marginBottom: '1rem', width: 'fit-content' }}
                                >
                                    <ArrowBackIcon style={{ fontSize: '0.9rem' }} />
                                    Back to Dashboard
                                </div>
                                <div>
                                    <h2>Enter Lobby</h2>
                                    <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        Room ID: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#2563EB' }}>
                                            {window.location.pathname.substring(1)}
                                        </span>
                                    </p>
                                </div>

                                <TextField
                                    id="outlined-basic"
                                    label="Display Name"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    variant="outlined"
                                    fullWidth
                                    autoFocus
                                    placeholder="What should we call you?"
                                    InputProps={{
                                        style: { borderRadius: '12px' }
                                    }}
                                    onKeyDown={e => { if (e.key === 'Enter') connect(); }}
                                />

                                <Button
                                    variant="contained"
                                    onClick={connect}
                                    style={{
                                        borderRadius: '12px',
                                        padding: '0.8rem',
                                        fontWeight: 600,
                                        textTransform: 'none',
                                        backgroundColor: '#2563EB',
                                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                                    }}
                                    fullWidth
                                >
                                    Join Meeting Room
                                </Button>
                            </div>
                        </div>
                    </div> :

                    <div className={styles.meetVideoContainer}>
                        {/* Left Info Badges Overlay */}
                        <div className={styles.meetingInfoBadge}>
                            <div className={styles.meetingCodeBadge}>
                                Room: {window.location.pathname.substring(1)}
                            </div>
                            <button className={styles.btnIconSm} title="Copy invitation link" onClick={copyMeetingCode}>
                                <ContentCopyIcon style={{ fontSize: '1rem' }} />
                            </button>
                            <div className={styles.meetingTimerBadge}>
                                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', marginRight: '0.25rem' }}></span>
                                {formatTime(timer)}
                            </div>
                        </div>

                        {showModal ?
                            <div className={styles.chatRoom}>
                                <div className={styles.chatContainer}>
                                    <div className={styles.chatHeader}>
                                        <h3>Meeting Chat</h3>
                                        <IconButton size="small" onClick={closeChat} style={{ color: 'white' }}>
                                            <CloseIcon style={{ fontSize: '1.25rem' }} />
                                        </IconButton>
                                    </div>

                                    <div className={styles.chattingDisplay}>
                                        {messages.length !== 0 ? messages.map((item, index) => {
                                            const isSelf = item.sender === username;
                                            return (
                                                <div
                                                    className={`${styles.chatMessage} ${isSelf ? styles.self : ''}`}
                                                    key={index}
                                                >
                                                    <span className={styles.chatMessageSender}>
                                                        {isSelf ? 'You' : item.sender}
                                                    </span>
                                                    <div className={styles.chatMessageBubble}>
                                                        {item.data}
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
                                            onChange={handleMessage}
                                            placeholder="Type a message..."
                                            onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
                                        />
                                        <button onClick={sendMessage}>Send</button>
                                    </div>
                                </div>
                            </div> : <></>
                        }

                        <div className={styles.buttonContainers}>
                            <IconButton
                                onClick={handleVideoToggle}
                                style={{ color: "white", padding: '10px' }}
                                className={videoEnabled ? styles.active : ''}
                            >
                                {videoEnabled ? <VideocamIcon /> : <VideocamOffIcon style={{ color: '#EF4444' }} />}
                            </IconButton>

                            <IconButton
                                onClick={handleAudioToggle}
                                style={{ color: "white", padding: '10px' }}
                                className={audioEnabled ? styles.active : ''}
                            >
                                {audioEnabled ? <MicIcon /> : <MicOffIcon style={{ color: '#EF4444' }} />}
                            </IconButton>

                            {screenAvailable === true ?
                                <IconButton
                                    onClick={handleScreenToggle}
                                    style={{ color: "white", padding: '10px' }}
                                    className={screenSharing ? styles.active : ''}
                                >
                                    {screenSharing ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                                </IconButton> : <></>}

                            <Badge badgeContent={newMessages > 0 ? newMessages : null} max={999} color='primary'>
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

                        {showParticipants && (
                            <div className={styles.participantsRoom}>
                                <div className={styles.chatHeader}>
                                    <h3>Participants ({videos.length + 1})</h3>
                                    <IconButton size="small" onClick={() => setShowParticipants(false)} style={{ color: 'white' }}>
                                        <CloseIcon style={{ fontSize: '1.25rem' }} />
                                    </IconButton>
                                </div>
                                <div className={styles.participantsList}>
                                    <div className={styles.participantRow}>
                                        <div className={styles.participantLeft}>
                                            <div className={styles.participantAvatar}>
                                                {username ? username.substring(0, 2).toUpperCase() : 'ME'}
                                            </div>
                                            <div className={styles.participantName}>
                                                {username} (You)
                                            </div>
                                        </div>
                                    </div>
                                    {videos.map((vid) => (
                                        <div className={styles.participantRow} key={vid.socketId}>
                                            <div className={styles.participantLeft}>
                                                <div className={styles.participantAvatar}>
                                                    G
                                                </div>
                                                <div className={styles.participantName}>
                                                    Guest ({vid.socketId.substring(0, 5)})
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className={`${styles.conferenceView} ${styles[videos.length + 1 <= 9 ? `participants-${videos.length + 1}` : 'participants-9'] || ''}`}>
                            {/* Local Participant Frame */}
                            <div>
                                <video
                                    className={styles.meetUserVideo}
                                    ref={setLocalVideoRef}
                                    autoPlay
                                    muted
                                    style={{ display: videoEnabled === true ? 'block' : 'none' }}
                                ></video>
                                {videoEnabled !== true && (
                                    <div className={styles.fallbackContainer}>
                                        <div className={styles.avatarFallback}>
                                            {username ? username.substring(0, 2).toUpperCase() : 'ME'}
                                        </div>
                                    </div>
                                )}
                                <div className={styles.participantLabel}>
                                    You ({username})
                                    {audioEnabled !== true && <MicOffIcon style={{ color: '#EF4444', fontSize: '0.9rem' }} />}
                                </div>
                            </div>

                            {/* Remote Participant Frames */}
                            {videos.map((vid) => (
                                <div key={vid.socketId}>
                                    <video
                                        data-socket={vid.socketId}
                                        ref={ref => {
                                            if (ref && vid.stream && ref.srcObject !== vid.stream) {
                                                ref.srcObject = vid.stream;
                                            }
                                        }}
                                        autoPlay
                                        playsInline
                                    >
                                    </video>
                                    <div className={styles.participantLabel}>
                                        Guest ({vid.socketId.substring(0, 5)})
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                }

                <Snackbar
                    open={copySuccess}
                    autoHideDuration={4000}
                    onClose={() => setCopySuccess(false)}
                    message="Meeting link copied to clipboard!"
                />
            </div>
        </ThemeProvider>
    );
}
