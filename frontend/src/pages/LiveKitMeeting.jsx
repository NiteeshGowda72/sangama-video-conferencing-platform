import {
    LiveKitRoom,
    VideoConference,
} from "@livekit/components-react";

import "@livekit/components-styles";

export default function LiveKitMeeting({
    token,
    serverUrl,
}) {
    return (
        <LiveKitRoom
            token={token}
            serverUrl={serverUrl}
            connect={true}
            video={true}
            audio={true}
        >
            <VideoConference />
        </LiveKitRoom>
    );
}