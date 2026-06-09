import express from "express";
import { createServer } from "node:http";

import { Server } from "socket.io";

import mongoose from "mongoose";
import { connectToSocket } from "./controllers/socketManager.js";

import cors from "cors";
import userRoutes from "./routes/users.routes.js";

import livekitRoutes from "./routes/livekitRoutes.js";

import dotenv from "dotenv";
const result = dotenv.config();

console.log(result.parsed);
console.log(process.env);
console.log("ALL ENV KEYS:");
console.log(Object.keys(process.env).filter(k => k.includes("LIVEKIT")));


const app = express();
const server = createServer(app);
const io = connectToSocket(server);


app.set("port", (process.env.PORT || 8000))
app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));
app.use("/api/livekit", livekitRoutes);
app.use("/api/v1/users", userRoutes);

const start = async () => {
    try {
        const connectionDb = await mongoose.connect(
            process.env.MONGO_URI
        );

        console.log(`MONGO Connected DB Host: ${connectionDb.connection.host}`);

        server.listen(app.get("port"), () => {
            console.log("LISTENING ON PORT 8000");
        });

    } catch (error) {
        console.error(error);
    }
}



start();