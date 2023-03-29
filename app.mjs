import { env } from "node:process";
import http from "http";
import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import { Server } from "socket.io";
dotenv.config();

import { adminStates } from "./game.mjs";
import { onValidSessionId } from "./utils/session.mjs";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: `http://${env.DOMAIN}:${env.CLIENT_PORT}`,
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: `http://${env.DOMAIN}:${env.CLIENT_PORT}`,
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send();
});

// storing all game sessions in memory
let sessions = {};

io.on("connection", (socket) => {
  /* Connect client to session
   * @function
   * @param {String} sessionId the id of the session to join
   */
  socket.on("join-session", ({ sessionId, username }, callback) => {
    let isUsernameTaken = false;

    onValidSessionId(
      (session) => {
        for (const player of session.players) {
          if (player.username.toLowerCase() == username.toLowerCase()) {
            isUsernameTaken = true;
            callback({ error: "username taken" });
            break;
          }
        }

        if (!isUsernameTaken) {
          const adminState = !session.adminState;
          session.players.push({
            username: username,
            isAdmin: adminState,
          });
          if (adminState) {
            session.adminState = adminStates.hasAdmin;
          }
          callback(session);
        }
      },
      sessions,
      sessionId
    );
  });

  socket.on("is-admin", ({ sessionId, username }, callback) => {
    callback(
      onValidSessionId(
        (session) => {
          for (const player of session.players) {
            if (player.username == username) {
              console.log(player);
              return player.isAdmin;
            }
          }
        },
        sessions,
        sessionId
      )
    );
  });

  /* Send message to all clients (includin sender) in the same session
   * @function
   * @param {String} message the message to send
   * @param {String} sessionId the id of the session
   */
  socket.on("chat", (message, sessionId) =>
    io.in(sessionId).emit("receive-chat", message)
  );
});

export default server;
