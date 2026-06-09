import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

import LiveKitMeeting from "./LiveKitMeeting";
import server from "../environment";

export default function MeetingRoom() {
    const { url } = useParams();

    const [token, setToken] = useState(null);

    const username =
        localStorage.getItem("username") ||
        `Guest-${Math.random().toString(36).slice(2, 10)}`;
    useEffect(() => {
        const getToken = async () => {
            try {
                const response = await axios.post(
                    `${server}/api/livekit/token`,
                    {
                        roomName: url,
                        username,
                    }
                );

                setToken(response.data.token);
            } catch (err) {
                console.error(err);
            }
        };

        getToken();
    }, [url, username]);

    if (!token) {
        return <h2>Loading Meeting...</h2>;
    }

    return (
        <LiveKitMeeting
            token={token}
            serverUrl={process.env.REACT_APP_LIVEKIT_URL}
        />
    );
}