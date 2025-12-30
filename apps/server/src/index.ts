import "dotenv/config";

import { createServer } from "node:http";
import cors from "cors";
import express from "express";

import { setupSocket } from "@/lib/socket";

const app = express();

app.use(
	cors({
		origin: process.env.CORS_ORIGIN || "",
		methods: ["GET", "POST", "OPTIONS"],
	}),
);

app.use(express.json());

app.get("/health", (_req, res) => {
	res.status(200).send("OK");
});

const port = process.env.PORT || 3000;
const server = createServer();

setupSocket(server);

server.listen(port, () => {
	console.log(`Server running on: ${port}`);
});
