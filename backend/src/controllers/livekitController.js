import { AccessToken } from "livekit-server-sdk";

export const generateToken = async (req, res) => {
    try {
        const { roomName, username } = req.body;

        console.log(
            process.env.LIVEKIT_API_KEY
        );

        console.log(
            process.env.LIVEKIT_API_SECRET
        );

        const token = new AccessToken(
            process.env.LIVEKIT_API_KEY,
            process.env.LIVEKIT_API_SECRET,
            {
                identity: username,
            }
        );

        token.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true,
        });

        const jwt = await token.toJwt();

        return res.json({
            token: jwt,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: "Token generation failed",
        });
    }
};