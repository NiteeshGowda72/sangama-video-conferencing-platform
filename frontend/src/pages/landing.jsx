import React from 'react'
import "../App.css"
import { useNavigate } from 'react-router-dom'

// Import modern Material UI icons
import VideocamIcon from '@mui/icons-material/Videocam';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import HistoryIcon from '@mui/icons-material/History';
import SecurityIcon from '@mui/icons-material/Security';
import DevicesIcon from '@mui/icons-material/Devices';
import SpeedIcon from '@mui/icons-material/Speed';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';


export default function LandingPage() {
    const navigate = useNavigate();

    const [isDark, setIsDark] = React.useState(false);

    React.useEffect(() => {
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

    // Check auth status for CTA buttons
    const handleStartAction = () => {
        if (localStorage.getItem("token")) {
            navigate("/home");
        } else {
            navigate("/auth");
        }
    };

    const handleJoinAction = () => {
        if (localStorage.getItem("token")) {
            navigate("/home");
        } else {
            navigate("/auth");
        }
    };

    return (
        <div className='landingPageContainer'>
            {/* Section 1: Sticky Navigation */}
            <nav>
                <div className='navHeader'>
                    <h2>
                        <VideocamIcon style={{ color: '#2563EB', fontSize: '1.8rem' }} />
                        SANGAMA
                    </h2>
                </div>
                <div className='navlist'>
                    <a href="#features">Features</a>
                    <a href="#why-us">Security</a>
                    <a href="#contact">Contact</a>
                    
                    <button className="btn-theme-toggle" onClick={toggleTheme} title="Toggle dark mode" style={{ margin: 0 }}>
                        {isDark ? <LightModeIcon style={{ fontSize: '1.25rem' }} /> : <DarkModeIcon style={{ fontSize: '1.25rem' }} />}
                    </button>
                    <p onClick={() => navigate("/auth")} style={{ margin: 0 }}>Sign In</p>
                    <button className="btn-primary" onClick={() => navigate("/auth")}>
                        Get Started
                    </button>
                </div>
            </nav>

            {/* Section 2: Hero Section */}
            <main className="landingMainContainer">
                <div className="heroContent">
                    <h1>
                        Professional video meetings<br />
                        built for <span>remote teams</span>
                    </h1>
                    <p>
                        Secure, fast, and reliable collaboration platform designed for modern organizations. Connect with anyone, anywhere, instantly.
                    </p>
                    <div className="heroButtons">
                        <button className="btn-hero-primary" onClick={handleStartAction}>
                            Start Meeting
                        </button>
                        <button className="btn-hero-secondary" onClick={handleJoinAction}>
                            Join Meeting
                        </button>
                    </div>
                </div>

                {/* Technology Stack Grid */}
                <div className="statsGrid">
                    <div className="statCard">
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '0.4rem' }}>React</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Frontend Interface</p>
                    </div>
                    <div className="statCard">
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '0.4rem' }}>Node.js & Express</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>REST Server API</p>
                    </div>
                    <div className="statCard">
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '0.4rem' }}>Socket.IO & WebRTC</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Real-Time Video Stream</p>
                    </div>
                    <div className="statCard">
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '0.4rem' }}>MongoDB & Mongoose</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>User activity logs</p>
                    </div>
                </div>
            </main>

            {/* Section 3: Features Grid */}
            <section id="features" className="featuresSection">
                <div className="sectionHeader">
                    <h2>Everything you need for seamless meetings</h2>
                    <p>Our comprehensive platform provides enterprise-grade collaboration tools right inside your browser.</p>
                </div>
                <div className="featuresGrid">
                    <div className="featureCard">
                        <div className="featureIcon">
                            <VideocamIcon />
                        </div>
                        <h3>HD Video Meetings</h3>
                        <p>Crystal-clear video and high-fidelity audio streams optimize your face-to-face team collaboration.</p>
                    </div>
                    
                    <div className="featureCard">
                        <div className="featureIcon">
                            <ScreenShareIcon />
                        </div>
                        <h3>Screen Sharing</h3>
                        <p>Share your slide decks, spreadsheets, or browser screens instantly with one simple click.</p>
                    </div>

                    <div className="featureCard">
                        <div className="featureIcon">
                            <ChatIcon />
                        </div>
                        <h3>Real-Time Chat</h3>
                        <p>Send messages, share links, and collaborate inline in the sidebar chat during call sessions.</p>
                    </div>

                    <div className="featureCard">
                        <div className="featureIcon">
                            <HistoryIcon />
                        </div>
                        <h3>Meeting History</h3>
                        <p>Track your past meetings, review dates, and reconnect instantly using your history log.</p>
                    </div>

                    <div className="featureCard">
                        <div className="featureIcon">
                            <SecurityIcon />
                        </div>
                        <h3>Secure Authentication</h3>
                        <p>Protect your profile and meetings with strict secure credentials and encrypted token handshakes.</p>
                    </div>

                    <div className="featureCard">
                        <div className="featureIcon">
                            <DevicesIcon />
                        </div>
                        <h3>Cross Platform Access</h3>
                        <p>Join sessions on desktop, laptop, or mobile browser screens with zero installations required.</p>
                    </div>
                </div>
            </section>

            {/* Section 4: Why Sangama */}
            <section id="why-us" className="whySection">
                <div className="sectionHeader">
                    <h2>Designed for high performance</h2>
                    <p>Why modern companies choose Sangama over traditional conferencing applications.</p>
                </div>
                <div className="whyGrid">
                    <div className="whyCol">
                        <h3>
                            <SpeedIcon style={{ color: '#2563EB' }} />
                            Ultra-Low Latency
                        </h3>
                        <p>
                            Leveraging modern WebRTC data and media channels, Sangama delivers sub-second stream latency, keeping conversations natural and productive without annoying audio delay.
                        </p>
                    </div>

                    <div className="whyCol">
                        <h3>
                            <SecurityIcon style={{ color: '#2563EB' }} />
                            Enterprise Privacy
                        </h3>
                        <p>
                            Your security is our priority. Media streams are established directly peer-to-peer using STUN protocols, keeping conference signals private and encrypted between participants.
                        </p>
                    </div>

                    <div className="whyCol">
                        <h3>
                            <CloudQueueIcon style={{ color: '#2563EB' }} />
                            Web Native Architecture
                        </h3>
                        <p>
                            No heavy desktop applications to install. No bloated browser extensions. Simply share a secure URL link and join the virtual lobby room immediately in under five seconds.
                        </p>
                    </div>
                </div>
            </section>



            {/* Section 5: Call To Action & Footer */}
            <section id="contact" className="ctaSection">
                <div className="ctaContent">
                    <h2>Ready to get started?</h2>
                    <p>Create secure meetings, share ideas, and connect with your team today on Sangama.</p>
                    <button className="btn-hero-primary" style={{ boxShadow: 'none' }} onClick={() => navigate("/auth")}>
                        Join Sangama Free
                    </button>
                </div>
            </section>
        </div>
    )
}
