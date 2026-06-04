import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { AuthContext } from '../contexts/AuthContext';
import { Snackbar, InputAdornment, IconButton } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';

export default function Authentication() {
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

    const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [name, setName] = React.useState("");
    const [error, setError] = React.useState("");
    const [message, setMessage] = React.useState("");
    const [formState, setFormState] = React.useState(0); // 0 = Login, 1 = Register
    const [open, setOpen] = React.useState(false);
    const [showPassword, setShowPassword] = React.useState(false);
    const [rememberMe, setRememberMe] = React.useState(false);

    const { handleRegister, handleLogin } = React.useContext(AuthContext);

    const handleClickShowPassword = () => setShowPassword((show) => !show);

    const handleAuth = async (e) => {
        if (e) e.preventDefault();
        
        if (!username || !password || (formState === 1 && !name)) {
            setError("Please fill out all required fields.");
            return;
        }

        try {
            if (formState === 0) {
                await handleLogin(username, password);
            }
            if (formState === 1) {
                let result = await handleRegister(name, username, password);
                console.log(result);
                setUsername("");
                setMessage(result);
                setOpen(true);
                setError("");
                setFormState(0);
                setPassword("");
                setName("");
            }
        } catch (err) {
            console.log(err);
            let errMsg = err.response?.data?.message || "An authentication error occurred. Please try again.";
            setError(errMsg);
        }
    };

    return (
        <ThemeProvider theme={theme}>
            <div className="authContainer">
                <Box className="authCard">
                    {/* Back Navigation & Theme Toggle */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '1.25rem' }}>
                        <Link 
                            href="#" 
                            onClick={(e) => { e.preventDefault(); navigate("/"); }}
                            sx={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '0.5rem', 
                                textDecoration: 'none', 
                                color: 'text.secondary', 
                                fontWeight: 600, 
                                fontSize: '0.85rem',
                                '&:hover': { color: 'primary.main' }
                            }}
                        >
                            <ArrowBackIcon style={{ fontSize: '1rem' }} />
                            Back to Home
                        </Link>
                        
                        <button className="btn-theme-toggle" type="button" onClick={toggleTheme} title="Toggle dark mode" style={{ margin: 0 }}>
                            {isDark ? <LightModeIcon style={{ fontSize: '1.15rem' }} /> : <DarkModeIcon style={{ fontSize: '1.15rem' }} />}
                        </button>
                    </div>

                    {/* Header Logo */}
                    <div className="authHeader">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <VideocamIcon style={{ color: '#2563EB', fontSize: '2rem' }} />
                            <Typography className="authLogo" variant="h2" component="span" style={{ margin: 0 }}>
                                SANGAMA
                            </Typography>
                        </div>
                        <Typography className="authWelcome" variant="body2">
                            {formState === 0 
                                ? "Welcome back! Please enter your details." 
                                : "Create a new account to host video meetings."}
                        </Typography>
                    </div>

                    {/* Switch Tabs */}
                    <div className="authTabs">
                        <div 
                            className={`authTab ${formState === 0 ? 'active' : ''}`} 
                            onClick={() => { setFormState(0); setError(""); }}
                        >
                            Sign In
                        </div>
                        <div 
                            className={`authTab ${formState === 1 ? 'active' : ''}`} 
                            onClick={() => { setFormState(1); setError(""); }}
                        >
                            Sign Up
                        </div>
                    </div>

                    {/* Authentication Form */}
                    <Box component="form" onSubmit={handleAuth} noValidate sx={{ mt: 1, width: '100%' }}>
                        {formState === 1 && (
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                id="name"
                                label="Full Name"
                                name="name"
                                value={name}
                                autoFocus={formState === 1}
                                onChange={(e) => setName(e.target.value)}
                                sx={{ mb: 1.5 }}
                            />
                        )}

                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="username"
                            label="Username"
                            name="username"
                            value={username}
                            autoFocus={formState === 0}
                            onChange={(e) => setUsername(e.target.value)}
                            sx={{ mb: 1.5 }}
                        />

                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label="Password"
                            value={password}
                            type={showPassword ? "text" : "password"}
                            id="password"
                            onChange={(e) => setPassword(e.target.value)}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            aria-label="toggle password visibility"
                                            onClick={handleClickShowPassword}
                                            edge="end"
                                            size="small"
                                        >
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                            sx={{ mb: 1 }}
                        />

                        {/* Extra controls (Remember me / Forgot password) */}
                        {formState === 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, mb: 1.5 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox 
                                            value="remember" 
                                            color="primary" 
                                            size="small"
                                            checked={rememberMe} 
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                        />
                                    }
                                    label={<Typography variant="body2" sx={{ color: 'text.secondary', userSelect: 'none' }}>Remember me</Typography>}
                                />
                                <Link 
                                    href="#" 
                                    variant="body2" 
                                    sx={{ textDecoration: 'none', fontWeight: 600, '&:hover': { color: 'primary.dark' } }}
                                    onClick={(e) => { e.preventDefault(); alert("Password recovery is handled by your organization's IT department."); }}
                                >
                                    Forgot password?
                                </Link>
                            </Box>
                        )}

                        {error && (
                            <Typography variant="body2" style={{ color: '#EF4444', marginTop: '8px', fontSize: '0.85rem', fontWeight: 500 }}>
                                {error}
                            </Typography>
                        )}

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2 }}
                        >
                            {formState === 0 ? "Login" : "Register"}
                        </Button>
                    </Box>
                </Box>
            </div>

            <Snackbar
                open={open}
                autoHideDuration={4000}
                onClose={() => setOpen(false)}
                message={message}
            />
        </ThemeProvider>
    );
}