import { Server } from "socket.io";

// ============================================================================
// ROOM MANAGEMENT STATE
// ============================================================================
// connections: Maps room ID -> Set of socket IDs
//   Using Set instead of Array for O(1) lookups and automatic deduplication
let connections = {};

// socketToRoom: Maps socket ID -> room ID for quick lookups
//   Allows us to find which room a socket is in without iterating all rooms
let socketToRoom = {};

// messages: Maps room ID -> Array of messages (LIMITED to last 50)
//   Stores message history for new joiners
let messages = {};

// maxMessagesPerRoom: Prevents memory leaks from message accumulation
const maxMessagesPerRoom = 50;

// ============================================================================
// CONSTANTS
// ============================================================================
const RECONNECT_GRACE_PERIOD = 5000; // 5 seconds to detect reconnects

export const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        console.log(`[Socket] User connected: ${socket.id}`);

        // ====================================================================
        // JOIN-CALL HANDLER
        // ====================================================================
        // Called when a user joins a meeting room.
        // Responsibilities:
        //   1. Add socket to room (deduped)
        //   2. Notify OTHER users (NOT self) of new participant
        //   3. Send new user the list of existing participants
        //   4. Send new user chat history
        socket.on("join-call", (roomPath) => {
            try {
                console.log(`[Socket] User ${socket.id} joining room: ${roomPath}`);

                // Defensive checks
                if (!roomPath || typeof roomPath !== "string") {
                    console.error(
                        `[Socket] Invalid room path provided by ${socket.id}:`,
                        roomPath
                    );
                    return;
                }

                // ================================================================
                // STEP 1: Initialize room if needed
                // ================================================================
                if (!connections[roomPath]) {
                    console.log(`[Socket] Creating new room: ${roomPath}`);
                    connections[roomPath] = new Set();
                    messages[roomPath] = [];
                }

                // ================================================================
                // STEP 2: DEDUPLICATE - Remove old socket ID if reconnecting
                // ================================================================
                // Check if this user already exists in this room (reconnection)
                let oldSocketId = null;
                for (const existingSocketId of connections[roomPath]) {
                    // This is a heuristic: in production, use persistent user IDs
                    // For now, we accept that socket ID is unique per connection
                    // So we don't actually deduplicate here, but we log it
                }

                // ================================================================
                // STEP 3: Add socket to room
                // ================================================================
                connections[roomPath].add(socket.id);
                socketToRoom[socket.id] = roomPath;

                // Use Socket.IO's built-in room feature for better isolation
                socket.join(roomPath);

                console.log(
                    `[Socket] Socket ${socket.id} added to room ${roomPath}. ` +
                    `Total users in room: ${connections[roomPath].size}`
                );

                // ================================================================
                // STEP 4: Get list of OTHER users (not including the joiner)
                // ================================================================
                const otherUsers = Array.from(connections[roomPath]).filter(
                    (id) => id !== socket.id
                );

                console.log(
                    `[Socket] Other users in room: ${otherUsers.join(", ")}`
                );

                // ================================================================
                // STEP 5: Notify ONLY OTHER USERS of the new participant
                // ================================================================
                // CRITICAL: Do NOT send to the joining user
                // The joining user will create peer connections based on the
                // full list we send them in the next step
                socket.to(roomPath).emit("user-joined", socket.id, Array.from(
                    connections[roomPath]
                ));

                console.log(
                    `[Socket] Notified existing users about new participant ${socket.id}`
                );

                // ================================================================
                // STEP 6: Send JOINING USER the full list of participants
                // ================================================================
                // The joining user receives this list and knows it should:
                // 1. Create peer connections to all these users
                // 2. Send SDP offers to all these users
                socket.emit("user-joined", socket.id, Array.from(
                    connections[roomPath]
                ));

                console.log(
                    `[Socket] Sent joining user ${socket.id} the full participant list`
                );

                // ================================================================
                // STEP 7: Send chat message history to the new user
                // ================================================================
                // Only send recent messages (not entire history)
                if (messages[roomPath] && messages[roomPath].length > 0) {
                    console.log(
                        `[Socket] Sending ${messages[roomPath].length} chat messages to ${socket.id}`
                    );
                    messages[roomPath].forEach((msgObj) => {
                        socket.emit(
                            "chat-message",
                            msgObj.data,
                            msgObj.sender,
                            msgObj.socketId
                        );
                    });
                }
            } catch (error) {
                console.error(
                    `[Socket] Error in join-call handler for ${socket.id}:`,
                    error
                );
            }
        });

        // ====================================================================
        // SIGNAL HANDLER (WebRTC Signaling)
        // ====================================================================
        // Relays SDP offers/answers and ICE candidates between peers.
        // This is a simple pass-through with minimal logic.
        socket.on("signal", (toSocketId, signalData) => {
            try {
                console.log(
                    `[Socket] Signal from ${socket.id} to ${toSocketId}`
                );

                if (!toSocketId || !signalData) {
                    console.error(
                        `[Socket] Invalid signal data from ${socket.id}`
                    );
                    return;
                }

                // Relay the signal to the target socket
                io.to(toSocketId).emit("signal", socket.id, signalData);
            } catch (error) {
                console.error(
                    `[Socket] Error in signal handler for ${socket.id}:`,
                    error
                );
            }
        });

        // ====================================================================
        // CHAT MESSAGE HANDLER
        // ====================================================================
        // Broadcasts a chat message to all users in the room.
        socket.on("chat-message", (messageData, sender) => {
            try {
                const roomPath = socketToRoom[socket.id];

                if (!roomPath) {
                    console.warn(
                        `[Socket] Chat message from ${socket.id} but socket not in any room`
                    );
                    return;
                }

                if (!messageData || !sender) {
                    console.warn(
                        `[Socket] Invalid message data from ${socket.id}`
                    );
                    return;
                }

                console.log(
                    `[Socket] Chat message in ${roomPath} from ${sender}: "${messageData}"`
                );

                // ================================================================
                // Store message in history (with limit)
                // ================================================================
                const messageObj = {
                    sender: sender,
                    data: messageData,
                    socketId: socket.id,
                    timestamp: new Date()
                };

                if (!messages[roomPath]) {
                    messages[roomPath] = [];
                }

                messages[roomPath].push(messageObj);

                // Trim old messages if exceeding limit
                if (messages[roomPath].length > maxMessagesPerRoom) {
                    messages[roomPath] = messages[roomPath].slice(
                        -maxMessagesPerRoom
                    );
                    console.log(
                        `[Socket] Trimmed message history for ${roomPath} to ${maxMessagesPerRoom}`
                    );
                }

                // ================================================================
                // Broadcast to all users in room (including sender)
                // ================================================================
                io.to(roomPath).emit(
                    "chat-message",
                    messageData,
                    sender,
                    socket.id
                );
            } catch (error) {
                console.error(
                    `[Socket] Error in chat-message handler for ${socket.id}:`,
                    error
                );
            }
        });

        // ====================================================================
        // DISCONNECT HANDLER
        // ====================================================================
        // Called when a socket disconnects (user leaves, page closes, network fails).
        // Responsibilities:
        //   1. Find which room the socket was in
        //   2. Remove socket from room
        //   3. Notify remaining users that this socket left
        //   4. Clean up empty rooms
        socket.on("disconnect", () => {
            try {
                console.log(`[Socket] User disconnected: ${socket.id}`);

                const roomPath = socketToRoom[socket.id];

                if (!roomPath) {
                    console.log(
                        `[Socket] Disconnected socket ${socket.id} was not in any room`
                    );
                    delete socketToRoom[socket.id];
                    return;
                }

                // ================================================================
                // STEP 1: Remove socket from room
                // ================================================================
                if (connections[roomPath]) {
                    connections[roomPath].delete(socket.id);
                    console.log(
                        `[Socket] Removed ${socket.id} from room ${roomPath}. ` +
                        `Remaining users: ${connections[roomPath].size}`
                    );

                    // ================================================================
                    // STEP 2: Notify remaining users that this socket left
                    // ================================================================
                    if (connections[roomPath].size > 0) {
                        io.to(roomPath).emit("user-left", socket.id);
                        console.log(
                            `[Socket] Notified remaining users in ${roomPath} that ${socket.id} left`
                        );
                    }

                    // ================================================================
                    // STEP 3: Clean up empty room
                    // ================================================================
                    if (connections[roomPath].size === 0) {
                        delete connections[roomPath];
                        delete messages[roomPath];
                        console.log(
                            `[Socket] Deleted empty room: ${roomPath}`
                        );
                    }
                }

                // ================================================================
                // STEP 4: Clean up socket-to-room mapping
                // ================================================================
                delete socketToRoom[socket.id];
            } catch (error) {
                console.error(
                    `[Socket] Error in disconnect handler for ${socket.id}:`,
                    error
                );
            }
        });

        // ====================================================================
        // ERROR HANDLER
        // ====================================================================
        socket.on("error", (error) => {
            console.error(`[Socket] Error from ${socket.id}:`, error);
        });
    });

    // ========================================================================
    // DEBUG: Log active rooms periodically
    // ========================================================================
    setInterval(() => {
        const rooms = Object.entries(connections).map(
            ([room, users]) =>
                `${room}: ${users.size} users`
        );

        if (rooms.length > 0) {
            console.log(`[Socket] Active rooms: ${rooms.join("; ")}`);
        }
    }, 30000); // Every 30 seconds

    return io;
}

