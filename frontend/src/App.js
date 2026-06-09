import './App.css';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import LandingPage from './pages/landing';
import Authentication from './pages/authentication';
import HomeComponent from './pages/home';
import History from './pages/history';
import MeetingRoom from './pages/MeetingRoom';

import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <div className="App">
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />

            <Route path="/auth" element={<Authentication />} />

            <Route path="/home" element={<HomeComponent />} />

            <Route path="/history" element={<History />} />

            <Route
              path="/meeting/:url"
              element={<MeetingRoom />}
            />
          </Routes>
        </AuthProvider>
      </Router>
    </div>
  );
}

export default App;