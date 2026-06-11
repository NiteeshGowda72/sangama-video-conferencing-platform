import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { TextField, Button } from "@mui/material";
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import LiveKitMeeting from "./LiveKitMeeting";
import server from "../environment";

export default function MeetingRoom() {
    const { url } = useParams();
    const navigate = useNavigate();

    const [token, setToken] = useState(null);
    const [joined, setJoined] = useState(false);
    const [sessionKey, setSessionKey] = useState(0);
    const [username, setUsername] = useState(
        localStorage.getItem("username") || ""
    );
    const [loading, setLoading] = useState(false);
    const leaveHandledRef = useRef(false);

    const stopPreviewStream = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
    }, []);

    const [videoAvailable, setVideoAvailable] = useState(false);
    const [audioAvailable, setAudioAvailable] = useState(false);
    const localStreamRef = useRef(null);
    const localVideoRef = useRef(null);

    const setLocalVideoRef = (el) => {
        localVideoRef.current = el;
        if (el && localStreamRef.current) {
            el.srcObject = localStreamRef.current;
        }
    };

    useEffect(() => {
        leaveHandledRef.current = false;
    }, [url]);

    useEffect(() => {
        if (joined) return;

        const getPermissionsAndInitMedia = async () => {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setVideoAvailable(false);
                setAudioAvailable(false);
                return;
            }

            let hasVideo = false;
            let hasAudio = false;

            try {
                const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
                vStream.getTracks().forEach(t => t.stop());
                setVideoAvailable(true);
                hasVideo = true;
            } catch (err) {
                setVideoAvailable(false);
            }

            try {
                const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                aStream.getTracks().forEach(t => t.stop());
                setAudioAvailable(true);
                hasAudio = true;
            } catch (err) {
                setAudioAvailable(false);
            }

            try {
                if (hasVideo || hasAudio) {
                    const mediaStream = await navigator.mediaDevices.getUserMedia({
                        video: hasVideo,
                        audio: hasAudio
                    });
                    localStreamRef.current = mediaStream;
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = mediaStream;
                    }
                }
            } catch (err) {
                console.error("[Lobby] Error setting up preview stream:", err);
            }
        };

        getPermissionsAndInitMedia();

        return () => {
            stopPreviewStream();
        };
    }, [joined, stopPreviewStream]);

    const handleJoin = async () => {
        if (!username.trim()) {
            alert("Please enter a username before connecting.");
            return;
        }

        setLoading(true);
        localStorage.setItem("username", username);
        leaveHandledRef.current = false;

        stopPreviewStream();

        try {
            const response = await axios.post(
                `${server}/api/livekit/token`,
                {
                    roomName: url,
                    username,
                }
            );

            setToken(response.data.token);
            setSessionKey((k) => k + 1);
            setJoined(true);
        } catch (err) {
            console.error("[MeetingRoom] Error joining room:", err);
            alert("Failed to join meeting room. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleLeaveMeeting = useCallback(() => {
        if (leaveHandledRef.current) return;
        leaveHandledRef.current = true;

        stopPreviewStream();
        setToken(null);
        setJoined(false);

        if (localStorage.getItem("token")) {
            navigate("/home", { replace: true });
        } else {
            navigate("/", { replace: true });
        }
    }, [navigate, stopPreviewStream]);

    if (joined && token) {
        return (
            <LiveKitMeeting
                key={`${url}-${sessionKey}`}
                token={token}
                serverUrl={process.env.REACT_APP_LIVEKIT_URL}
                onLeave={handleLeaveMeeting}
            />
        );
    }

    return (
        <div className="lobbyContainer">
            <div className="lobbyCard">
                <div className="lobbyPreview">
                    <div className="lobbyPreviewTitle">Green Room Preview</div>
                    <div className="videoFrame">
                        <video ref={setLocalVideoRef} autoPlay muted playsInline></video>
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
                                {url}
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
                        onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
                    />

                    <Button
                        variant="contained"
                        onClick={handleJoin}
                        style={{
                            borderRadius: '12px',
                            padding: '0.8rem',
                            fontWeight: 600,
                            textTransform: 'none',
                            backgroundColor: '#2563EB',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                        }}
                        fullWidth
                        disabled={loading}
                    >
                        {loading ? "Joining..." : "Join Meeting Room"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
