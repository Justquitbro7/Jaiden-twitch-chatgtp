import express from "express";
import fs from "fs";
import ws from "ws";
import expressWs from "express-ws";
import { job } from "./keep_alive.js";
import { OpenAIOperations } from "./openai_operations.js";
import { TwitchBot } from "./twitch_bot.js";
import { setInfoCanal } from "./sharedData.js";
import { setUserId } from "./sharedData.js";
import { setChannelId, getChannelId } from "./sharedData.js";

job.start();

const app = express();
const expressWsInstance = expressWs(app);

app.set("view engine", "ejs");

const GPT_MODE = process.env.GPT_MODE || "CHAT";
const HISTORY_LENGTH = process.env.HISTORY_LENGTH || 20;
const OPENAI_API_KEY_1 = process.env.OPENAI_API_KEY_1 || "";
const OPENAI_API_KEY_2 = process.env.OPENAI_API_KEY_2 || "";
const MODEL_NAME = process.env.MODEL_NAME; // Usarás esto para Shapes y OpenRouter
const TWITCH_USER = process.env.TWITCH_USER || "RodentPlay";
const TWITCH_AUTH =
	process.env.TWITCH_AUTH || "oauth:a34lxh7cbszmea7icbyxhtyeinvyoo";
const COMMAND_NAME = process.env.COMMAND_NAME || "@RodentPlay";
const CHANNELS =
	process.env.CHANNELS ||
	"AraxielFenix, Maritha_F, FooNess13, nunchuckya , soyyonotuxdjsjs";
const SEND_USERNAME = process.env.SEND_USERNAME || "true";
const ENABLE_TTS = process.env.ENABLE_TTS || "false";
const ENABLE_CHANNEL_POINTS = process.env.ENABLE_CHANNEL_POINTS || "false";
const COOLDOWN_DURATION = parseInt(process.env.COOLDOWN_DURATION, 10) || 10;
export const TOKEN = process.env.TOKEN;

let OPENAI_API_KEY = OPENAI_API_KEY_1;
let currentApiKey = 1;

if (!OPENAI_API_KEY_1 && !OPENAI_API_KEY_2) {
	console.error(
		"No se encontraron las API keys. Por favor, configúralas como variables de entorno."
	);
}

const commandNames = COMMAND_NAME.split(",").map((cmd) =>
	cmd.trim().toLowerCase()
);
const channels = CHANNELS.split(",").map((channel) => channel.trim());
const maxLength = 399;
//let fileContext = fs.readFileSync('./file_context.txt', 'utf8') + '\nPor favor, responde de manera resumida el mensaje del espectador: ';
let fileContext = "";
let lastResponseTime = 0;
let canal = "";

console.log("==================================\n");
console.log("Channels: ", channels);
console.log("==================================");
const bot = new TwitchBot(
	TWITCH_USER,
	TWITCH_AUTH,
	channels,
	OPENAI_API_KEY,
	ENABLE_TTS
);

const openaiOps = new OpenAIOperations(fileContext, HISTORY_LENGTH);

let currentStreamInfo = "";

async function updateStreamInfo(channel) {
	console.log("==================================");
	try {
		const info = await getStreamInfo(channel);
		console.log("Información del stream actualizada:", info);
		console.log("==================================");
		return info;
	} catch (error) {
		console.error("Error al actualizar la información del stream:", error);
		console.log("==================================");
		return "";
	}
}

bot.onConnected((addr, port) => {
	console.log("==================================");
	console.log(`* Conectandome a ${addr}:${port}`);
	channels.forEach((channel) => {
		console.log(`* Entrando al canal de ${channel}`);
		console.log(`* Correctamente presente con ${channel}`);
	});
	console.log("==================================");
});

bot.onDisconnected((reason) => {
	console.log("==================================\n");
	console.log(`Disconnected: ${reason}`);
	console.log("\n==================================");
});

bot.connect(
	() => {
		console.log("==================================");
		console.log("Bot connected!");
		updateStreamInfo(channel);
		setInterval(updateStreamInfo(channel), 60000);
		console.log("==================================");
	},
	(error) => {
		console.error("Bot couldn't connect!", error);
	}
);

bot.onMessage(async (channel, user, message, self) => {
	if (self) return;

	setUserId(user.username);
	setInfoCanal(await getStreamInfo(channel));
	setChannelId(channel);

	const currentTime = Date.now();
	const elapsedTime = (currentTime - lastResponseTime) / 1000;

	if (
		ENABLE_CHANNEL_POINTS === "true" &&
		user["msg-id"] === "highlighted-message"
	) {
		console.log(`Highlighted message: ${message}`);
		if (elapsedTime < COOLDOWN_DURATION) {
			bot.say(
				channel,
				`PoroSad Por favor, espera ${
					COOLDOWN_DURATION - elapsedTime.toFixed(1)
				} segundos antes de enviar otro mensaje. NotLikeThis`
			);
			console.log("==================================");
			return;
		}
		lastResponseTime = currentTime;

		let response;
		response = await openaiOps.make_openrouter_call(
			`${currentStreamInfo}\n\n${message}`
		);
		console.log("Respuesta para Twitch:", response);
		bot.say(channel, response);
		console.log("==================================");
	}

	const command = commandNames.find((cmd) =>
		message.toLowerCase().includes(cmd.toLowerCase())
	);
	if (command) {
		console.log("==================================");
		console.log("Mensaje recibido en el canal de " + channel + ": " + message);
		await updateStreamInfo(channel);
		if (elapsedTime < COOLDOWN_DURATION) {
			console.log("Mensaje de cooldown en el canal de " + channel);
			bot.say(
				channel,
				`PoroSad Por favor, espera ${
					COOLDOWN_DURATION - elapsedTime.toFixed(1)
				} segundos antes de enviar otro mensaje. NotLikeThis`
			);
			console.log("==================================");
			return;
		}
		lastResponseTime = currentTime;

		// Verifica si el texto está vacío
		let text = message.slice(command.length).trim();

		if (!text) {
			text = `Mensaje del usuario ${user.username}: ${message.trim()}`;
		} else if (SEND_USERNAME === "true") {
			text = `Mensaje del usuario ${user.username}: ${text}`;
		}

		let response;
		response = await openaiOps.make_openrouter_call(
			`${currentStreamInfo}\n\n${text}`
		);

		if (response.length > maxLength) {
			const messages = response.match(new RegExp(`.{1,${maxLength}}`, "g"));
			messages.forEach((msg, index) => {
				setTimeout(() => {
					console.log("Respuesta para Twitch:", response);
					bot.say(channel, msg);
					console.log("==================================");
				}, 1000 * index);
			});
		} else {
			console.log("Respuesta para Twitch:", response);
			bot.say(channel, response);
			console.log("==================================");
		}

		if (ENABLE_TTS === "true") {
			try {
				const ttsAudioUrl = await bot.sayTTS(
					channel,
					response,
					user["userstate"]
				);
				notifyFileChange(ttsAudioUrl);
			} catch (error) {
				console.error("TTS Error:", error);
			}
		}
	}
});

const messages = [
	{ role: "system", content: "You are a helpful Twitch Chatbot." },
];
console.log("==================================");
console.log("GPT_MODE:", GPT_MODE);
console.log("History length:", HISTORY_LENGTH);
console.log("OpenAI API Key:", OPENAI_API_KEY_1);
console.log("Model Name:", MODEL_NAME);
console.log("==================================");

app.use(express.json({ extended: true, limit: "1mb" }));
app.use("/public", express.static("public"));

app.all("/", (req, res) => {
	console.log("Received a request!");
	res.render("pages/index");
});

if (GPT_MODE === "CHAT") {
	fs.readFile("./file_context.txt", "utf8", (err, data) => {
		if (err) throw err;
		console.log(
			"Reading context file and adding it as system-level message for the agent."
		);
		messages[0].content = data;
	});
} else {
	fs.readFile("./file_context.txt", "utf8", (err, data) => {
		if (err) throw err;
		console.log("Reading context file and adding it in front of user prompts:");
		fileContext = data;
	});
}

app.get("/gpt/:text", async (req, res) => {
	const text = req.params.text;

	let answer = "";
	try {
		if (GPT_MODE === "CHAT") {
			answer = await openaiOps.make_openrouter_call(text);
		} else if (GPT_MODE === "PROMPT") {
			const prompt = `${fileContext}\n\nUser: ${text}\nAgent:`;
			answer = await openaiOps.make_openrouter_call_completion(prompt);
		} else {
			throw new Error(
				"GPT_MODE is not set to CHAT or PROMPT. Please set it as an environment variable."
			);
		}

		res.send(answer);
	} catch (error) {
		console.error("Error generating response:", error);
		res.status(500).send("An error occurred while generating the response.");
	}
});

const server = app.listen(3000, () => {
	console.log("Server running on port 3000");
});

const wss = expressWsInstance.getWss();
wss.on("connection", (ws) => {
	ws.on("message", (message) => {
		// Handle client messages (if needed)
	});
});

function notifyFileChange() {
	wss.clients.forEach((client) => {
		if (client.readyState === ws.OPEN) {
			client.send(JSON.stringify({ updated: true }));
		}
	});
}

async function getStreamInfo(channel) {
	canal = channel.substring(1);
	const urls = [
		`https://decapi.me/twitch/title/${canal}`,
		`https://decapi.me/twitch/game/${canal}`,
		`https://decapi.me/twitch/viewercount/${canal}`,
	];

	try {
		const [titleResponse, gameResponse, viewerResponse] = await Promise.all(
			urls.map((url) => fetch(url))
		);

		if (!titleResponse.ok || !gameResponse.ok || !viewerResponse.ok) {
			throw new Error("Network response was not ok");
		}

		const titulo = await titleResponse.text();
		const categoria = await gameResponse.text();
		const espectadores = await viewerResponse.text();

		return `\nMensaje recibido en el canal: ${canal}\nTitulo del stream: ${titulo}\nCategoria del stream: ${categoria}\nCantidad de espectadores: ${espectadores}\n`;
	} catch (error) {
		console.error("Error al obtener la información del stream:", error);
		return `\nMensaje recibido en el canal: ${canal} \nNo se pudo obtener la información del stream.\n`;
	}
}
