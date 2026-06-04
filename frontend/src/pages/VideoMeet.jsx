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

var connections = {};

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
}

export default function VideoMeetComponent() {
    const navigate = useNavigate();

    var socketRef = useRef();
    let socketIdRef = useRef();

    let localVideoref = useRef();

    let [videoAvailable, setVideoAvailable] = useState(true);

    let [audioAvailable, setAudioAvailable] = useState(true);

    let [video, setVideo] = useState([]);

    let [audio, setAudio] = useState();

    let [screen, setScreen] = useState();

    let [showModal, setModal] = useState(false); // default collapsible chat panel to false (hidden by default)
    const showModalRef = useRef(showModal);
    useEffect(() => {
        showModalRef.current = showModal;
    }, [showModal]);

    let [screenAvailable, setScreenAvailable] = useState();

    let [messages, setMessages] = useState([])

    let [message, setMessage] = useState("");

    let [newMessages, setNewMessages] = useState(0);

    let [askForUsername, setAskForUsername] = useState(true);

    let [username, setUsername] = useState("");

    const videoRef = useRef([])

    let [videos, setVideos] = useState([])

    // Collapsible side-by-side drawer components (Participants and Chat)
    let [showParticipants, setShowParticipants] = useState(false);
    let [copySuccess, setCopySuccess] = useState(false);
    
    // Persistent theme tracking
    const [isDark, setIsDark] = useState(false);

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

    // Meeting Session Timer State
    const [timer, setTimer] = useState(0);

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

    const copyMeetingCode = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopySuccess(true);
    };

    const toggleChat = () => {
        setModal(prev => {
            const next = !prev;
            if (next) {
                setShowParticipants(false);
            }
            return next;
        });
        setNewMessages(0);
    };

    const toggleParticipants = () => {
        setShowParticipants(prev => {
            const next = !prev;
            if (next) {
                setModal(false);
            }
            return next;
        });
    };

    // TODO
    // if(isChrome() === false) {


    // }

    useEffect(() => {
        console.log("HELLO")
        getPermissions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    let getDislayMedia = () => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .then((stream) => { })
                    .catch((e) => console.log(e))
            }
        }
    }

    const getPermissions = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Camera and microphone require HTTPS. Please open the site using HTTPS.");
            return;
        }
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoPermission) {
                setVideoAvailable(true);
                console.log('Video permission granted');
            } else {
                setVideoAvailable(false);
                console.log('Video permission denied');
            }

            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (audioPermission) {
                setAudioAvailable(true);
                console.log('Audio permission granted');
            } else {
                setAudioAvailable(false);
                console.log('Audio permission denied');
            }

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            } else {
                setScreenAvailable(false);
            }

            if (videoAvailable || audioAvailable) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });
                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoref.current) {
                        localVideoref.current.srcObject = userMediaStream;
                    }
                }
            }
        } catch (error) {
            console.log(error);
        }
    };

    useEffect(() => {
        if (video !== undefined && audio !== undefined) {
            getUserMedia();
            console.log("SET STATE HAS ", video, audio);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [video, audio])
    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();

    }




    let getUserMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        if (localVideoref.current) {
            localVideoref.current.srcObject = stream
        }

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            connections[id].addStream(window.localStream)

            connections[id].createOffer().then((description) => {
                console.log(description)
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            if (localVideoref.current) {
                localVideoref.current.srcObject = window.localStream
            }

            for (let id in connections) {
                connections[id].addStream(window.localStream)

                connections[id].createOffer().then((description) => {
                    connections[id].setLocalDescription(description)
                        .then(() => {
                            socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                        })
                        .catch(e => console.log(e))
                })
            }
        })
    }

    let getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .then((stream) => { })
                .catch((e) => console.log(e))
        } else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { }
        }
    }





    let getDislayMediaSuccess = (stream) => {
        console.log("HERE")
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        if (localVideoref.current) {
            localVideoref.current.srcObject = stream
        }

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            connections[id].addStream(window.localStream)

            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false)

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            if (localVideoref.current) {
                localVideoref.current.srcObject = window.localStream
            }

            getUserMedia()

        })
    }

    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message)

        if (fromId !== socketIdRef.current) {
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then((description) => {
                            connections[fromId].setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }

            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e))
            }
        }
    }




    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false })

        socketRef.current.on('signal', gotMessageFromServer)

        socketRef.current.on('connect', () => {
            socketRef.current.emit('join-call', window.location.href)
            socketIdRef.current = socketRef.current.id

            socketRef.current.on('chat-message', addMessage)

            socketRef.current.on('user-left', (id) => {
                setVideos((videos) => videos.filter((video) => video.socketId !== id))
            })

            socketRef.current.on('user-joined', (id, clients) => {
                clients.forEach((socketListId) => {

                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections)
                    // Wait for their ice candidate       
                    connections[socketListId].onicecandidate = function (event) {
                        if (event.candidate != null) {
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
                        }
                    }

                    // Wait for their video stream
                    connections[socketListId].onaddstream = (event) => {
                        console.log("BEFORE:", videoRef.current);
                        console.log("FINDING ID: ", socketListId);

                        let videoExists = videoRef.current.find(video => video.socketId === socketListId);

                        if (videoExists) {
                            console.log("FOUND EXISTING");

                            // Update the stream of the existing video
                            setVideos(videos => {
                                const updatedVideos = videos.map(video =>
                                    video.socketId === socketListId ? { ...video, stream: event.stream } : video
                                );
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        } else {
                            // Create a new video
                            console.log("CREATING NEW");
                            let newVideo = {
                                socketId: socketListId,
                                stream: event.stream,
                                autoplay: true,
                                playsinline: true
                            };

                            setVideos(videos => {
                                const updatedVideos = [...videos, newVideo];
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        }
                    };


                    // Add the local video stream
                    if (window.localStream !== undefined && window.localStream !== null) {
                        connections[socketListId].addStream(window.localStream)
                    } else {
                        let blackSilence = (...args) => new MediaStream([black(...args), silence()])
                        window.localStream = blackSilence()
                        connections[socketListId].addStream(window.localStream)
                    }
                })

                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue

                        try {
                            connections[id2].addStream(window.localStream)
                        } catch (e) { }

                        connections[id2].createOffer().then((description) => {
                            connections[id2].setLocalDescription(description)
                                .then(() => {
                                    socketRef.current.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription }))
                                })
                                .catch(e => console.log(e))
                        })
                    }
                }
            })
        })
    }

    let silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator()
        let dst = oscillator.connect(ctx.createMediaStreamDestination())
        oscillator.start()
        ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }
    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height })
        canvas.getContext('2d').fillRect(0, 0, width, height)
        let stream = canvas.captureStream()
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    let handleVideo = () => {
        setVideo(!video);
        // getUserMedia();
    }
    let handleAudio = () => {
        setAudio(!audio)
        // getUserMedia();
    }

    useEffect(() => {
        if (screen !== undefined) {
            getDislayMedia();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screen])
    let handleScreen = () => {
        setScreen(!screen);
    }

    let handleEndCall = () => {
        try {
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) { }
        if (localStorage.getItem("token")) {
            window.location.href = "/home";
        } else {
            window.location.href = "/";
        }
    }

    let closeChat = () => {
        setModal(false);
    }
    let handleMessage = (e) => {
        setMessage(e.target.value);
    }

    const addMessage = (data, sender, socketIdSender) => {
        setMessages((prevMessages) => [
            ...prevMessages,
            { sender: sender, data: data }
        ]);
        if (socketIdSender !== socketIdRef.current && !showModalRef.current) {
            setNewMessages((prevNewMessages) => prevNewMessages + 1);
        }
    };



    let sendMessage = () => {
        if (!message.trim()) return;
        console.log(socketRef.current);
        socketRef.current.emit('chat-message', message, username)
        setMessage("");

        // this.setState({ message: "", sender: username })
    }


    let connect = () => {
        if (!username.trim()) {
            alert("Please enter a username before connecting.");
            return;
        }
        setAskForUsername(false);
        getMedia();
    }


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
                                <video ref={localVideoref} autoPlay muted></video>
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

                    {showModal ? <div className={styles.chatRoom}>

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
                    </div> : <></>}


                    <div className={styles.buttonContainers}>
                        <IconButton 
                            onClick={handleVideo} 
                            style={{ color: "white", padding: '10px' }}
                            className={video === true ? styles.active : ''}
                        >
                            {(video === true) ? <VideocamIcon /> : <VideocamOffIcon style={{ color: '#EF4444' }} />}
                        </IconButton>
                        
                        <IconButton 
                            onClick={handleAudio} 
                            style={{ color: "white", padding: '10px' }}
                            className={audio === true ? styles.active : ''}
                        >
                            {audio === true ? <MicIcon /> : <MicOffIcon style={{ color: '#EF4444' }} />}
                        </IconButton>

                        {screenAvailable === true ?
                            <IconButton 
                                onClick={handleScreen} 
                                style={{ color: "white", padding: '10px' }}
                                className={screen === true ? styles.active : ''}
                            >
                                {screen === true ? <ScreenShareIcon /> : <StopScreenShareIcon />}
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
                                ref={localVideoref} 
                                autoPlay 
                                muted
                                style={{ display: video === true ? 'block' : 'none' }}
                            ></video>
                            {video !== true && (
                                <div className={styles.fallbackContainer}>
                                    <div className={styles.avatarFallback}>
                                        {username ? username.substring(0, 2).toUpperCase() : 'ME'}
                                    </div>
                                </div>
                            )}
                            <div className={styles.participantLabel}>
                                You ({username})
                                {audio !== true && <MicOffIcon style={{ color: '#EF4444', fontSize: '0.9rem' }} />}
                            </div>
                        </div>

                        {/* Remote Participant Frames */}
                        {videos.map((vid) => (
                            <div key={vid.socketId}>
                                <video
                                    data-socket={vid.socketId}
                                    ref={ref => {
                                        if (ref && vid.stream) {
                                            ref.srcObject = vid.stream;
                                        }
                                    }}
                                    autoPlay
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
    )
}
