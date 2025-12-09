import dotenv from "dotenv";
dotenv.config();
// import { CronJob } from 'cron'; // No se usa
// import https from 'https'; // No se usa
import {
	Client,
	GatewayIntentBits,
	ActivityType,
	Partials,
	ChannelType, // Añadido para identificar DMs
	// EmbedBuilder, // No se usa
} from "discord.js";
import { OpenAI } from "openai";

// --- Environment Variables and Constants ---
const OPENROUTER_API_KEY =
	process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY_1;
const MODEL_ID = process.env.MODEL_NAME;
const IMAGE_MODEL_ID = process.env.IMAGE_MODEL_ID; // Modelo para generar imágenes
const AUDIO_MODEL_ID = process.env.AUDIO_MODEL_ID; // Modelo para transcribir audio
const GENERAL_CHANNEL_ID = process.env.GENERAL_ID;
const IGNORED_CHANNEL_IDS_STRING = process.env.CHANNEL_ID || ""; // Canales a ignorar, separados por coma
const COMMAND_KEYWORDS_STRING = process.env.COMMAND_NAME || ""; // Palabras clave para activar el bot, separadas por coma
const DISCORD_TOKEN = process.env.TOKEN;

const BOT_PERSONA_PROMPT =
	"RodentBot es un inteligente moderador mexicano que nació el 17 de enero del 2024. Forma parte de la comunidad RodentPlay. Tiene personalidad divertida, usa emojis, reconoce nombres y hace juegos, pero también sabe moderar y dar la bienvenida.";

const MEE6_USER_ID = "159985870458322944"; // ID de MEE6 para ignorarlo
const IGNORED_ROLE_ID = "771230836678590484"; // ID del rol a ignorar

// Derived configurations
const IGNORED_CHANNEL_IDS = IGNORED_CHANNEL_IDS_STRING.split(",")
	.map((id) => id.trim())
	.filter((id) => id);
const COMMAND_KEYWORDS = COMMAND_KEYWORDS_STRING.split(",")
	.map((kw) => kw.trim().toLowerCase())
	.filter((kw) => kw);

// Basic validation for critical environment variables
if (!OPENROUTER_API_KEY) {
	console.error(
		"Error: OPENROUTER_API_KEY o OPENAI_API_KEY_1 no están definidos en el archivo .env."
	);
	process.exit(1);
}
if (!MODEL_ID) {
	console.error("Error: MODEL_NAME no está definido en el archivo .env.");
	process.exit(1);
}
if (!GENERAL_CHANNEL_ID) {
	console.error("Error: GENERAL_ID no está definido en el archivo .env.");
	process.exit(1);
}
if (!DISCORD_TOKEN) {
	console.error("Error: TOKEN no está definido en el archivo .env.");
	process.exit(1);
}

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildInvites,
		GatewayIntentBits.GuildEmojisAndStickers,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.DirectMessageTyping,
		GatewayIntentBits.GuildScheduledEvents,
	],
	partials: [Partials.GuildMember, Partials.Channel, Partials.Message], // Añadido Partials.Message
});

// --- Helper Functions ---
function logSeparator(char = "=", length = 50) {
	console.log(char.repeat(length));
}

async function callOpenRouterAPI(messages, headers, maxTokens = 200) {
	try {
		const response = await fetch(
			"https://openrouter.ai/api/v1/chat/completions",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${OPENROUTER_API_KEY}`,
					"HTTP-Referer": process.env.YOUR_SITE_URL || "http://localhost:3000",
					"X-Title": process.env.YOUR_SITE_NAME || "RodentBot",
					"Content-Type": "application/json",
					...headers,
				},
				body: JSON.stringify({
					model: MODEL_ID,
					messages: messages,
					max_tokens: maxTokens,
				}),
			}
		);
		const data = await response.json();
		if (!response.ok) {
			throw new Error(
				`OpenRouter API error: ${response.status} ${
					response.statusText
				} - ${JSON.stringify(data)}`
			);
		}
		return data.choices[0].message.content;
	} catch (error) {
		console.error(
			"Error llamando a la API de OpenRouter:",
			error.message || error
		);
		// Consider re-throwing or returning a specific error object/message
		// For now, we'll let the caller handle a potentially undefined response
		return null; // Or throw error;
	}
}

async function callOpenRouterImageAPI(prompt, headers) {
	try {
		const response = await fetch(
			"https://openrouter.ai/api/v1/images/generations",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${OPENROUTER_API_KEY}`,
					"HTTP-Referer": process.env.YOUR_SITE_URL || "http://localhost:3000",
					"X-Title": process.env.YOUR_SITE_NAME || "RodentBot",
					"Content-Type": "application/json",
					...headers,
				},
				body: JSON.stringify({
					model: IMAGE_MODEL_ID,
					prompt: prompt,
				}),
			}
		);
		const data = await response.json();
		if (!response.ok) {
			throw new Error(
				`OpenRouter Image API error: ${response.status} ${
					response.statusText
				} - ${JSON.stringify(data)}`
			);
		}
		return data.data[0].url; // Devuelve la URL de la imagen generada
	} catch (error) {
		console.error(
			"Error llamando a la API de imágenes de OpenRouter:",
			error.message || error
		);
		return null;
	}
}

// --- Bot State ---
const userConversations = new Map(); // Almacena el historial de conversaciones por usuario

client.on("ready", () => {
	console.log("🫡A la orden pal desorden.");
	client.user.setActivity("🫡A la orden pal desorden.", {
		type: ActivityType.Custom,
	});

	// Mensaje periódico
	setInterval(async () => {
		const canal = client.channels.cache.get(GENERAL_CHANNEL_ID);
		if (!canal) {
			console.error(
				`Error: Canal general con ID ${GENERAL_CHANNEL_ID} no encontrado para mensaje periódico.`
			);
			return;
		}

		try {
			await canal.sendTyping();
			const prompt =
				"Eres un moderador del Discord RodentPlay. Escribe un mensaje divertido y corto de hasta 4 renglones para invitar a todos a hablar, puedes preguntar temas sobre videojuegos favoritos, peliculas, series, anime, logros o hasta metas personales, puedes contar chistes, adivinanzas y diversos temas para hacer la platica en el servidor, pregunta una cosa unicamente para no desviar el tema.";

			const apiMessages = [
				{ role: "system", content: BOT_PERSONA_PROMPT },
				{ role: "user", content: prompt },
			];
			const headers = { "X-Channel-Id": `Canal de discord: ${canal.id}` }; // Usar canal.id

			const responseContent = await callOpenRouterAPI(
				apiMessages,
				headers,
				200
			);

			if (responseContent) {
				logSeparator();
				console.log("Contenido del mensaje periódico:", responseContent);
				canal.send({ content: responseContent });
			} else {
				console.log(
					"No hubo respuesta de la API de OpenRouter para el mensaje periódico."
				);
			}
		} catch (error) {
			console.error("Fallo al enviar mensaje periódico:", error);
		}
	}, 43200000); // cada 12 horas (43,200,000 ms)
});

client.on("guildMemberAdd", async (member) => {
	try {
		const canal = client.channels.cache.get(GENERAL_CHANNEL_ID);
		if (!canal) {
			console.error(
				`Error: Canal general con ID ${GENERAL_CHANNEL_ID} no encontrado para mensaje de bienvenida.`
			);
			return;
		}
		await canal.sendTyping();

		const prompt = `Un nuevo miembro se ha unido. Dale una bienvenida a @${member.user.username} en máximo 4 renglones.`;

		const apiMessages = [
			{ role: "system", content: BOT_PERSONA_PROMPT },
			{ role: "user", content: prompt },
		];
		const headers = {
			"X-User-Id": member.user.username,
			"X-Channel-Id": `Canal de discord: ${canal.id}`, // Usar canal.id para consistencia
		};

		const responseContent = await callOpenRouterAPI(apiMessages, headers, 200);

		if (responseContent) {
			logSeparator();
			console.log(`${member.user.username} acaba de unirse al Discord.`);
			console.log("Contenido del mensaje de bienvenida:", responseContent);
			logSeparator();
			canal.send({ content: responseContent });
		} else {
			console.log(
				`No hubo respuesta de la API para el nuevo miembro ${member.user.username}`
			);
		}
	} catch (error) {
		console.error("Error en bienvenida:", error);
	}
});

client.on("messageCreate", async (message) => {
	try {
		const isDM = message.channel.type === ChannelType.DM;

		// --- Condiciones de Ignorar Mensaje (Guard Clauses) ---

		// 1. Ignorar a MEE6
		if (message.author.id === MEE6_USER_ID) return;

		// 2. Ignorar al propio bot o comandos slash
		if (message.author.id === client.user.id || message.content.startsWith("/"))
			return;

		// 3. Ignorar usuarios con rol específico o rol "bot" (si no son bots reales)
		if (!isDM && message.member) {
			// message.member es null en DMs, esta lógica solo aplica a servidores
			if (message.member.roles.cache.has(IGNORED_ROLE_ID)) return;
			// Si el usuario NO es un bot, pero TIENE un rol llamado "bot" (case-insensitive)
			if (
				!message.author.bot &&
				message.member.roles.cache.some(
					(role) => role.name.toLowerCase() === "bot"
				)
			)
				return;
		}

		// 4. Ignorar canales específicos (solo si no es un DM)
		if (!isDM && IGNORED_CHANNEL_IDS.includes(message.channel.id)) return;

		// --- Lógica de Respuesta del Bot ---
		let debeResponder = false;
		if (isDM) {
			// Para DMs, siempre responder (a menos que otras condiciones de ignorar apliquen, como ser el propio bot)
			debeResponder = true;
		} else {
			// Para mensajes en servidor, determinar si el bot debe responder (mención o palabra clave)
			debeResponder = message.mentions.has(client.user);
			if (!debeResponder && COMMAND_KEYWORDS.length > 0) {
				const messageContentLowerCase = message.content.toLowerCase();
				debeResponder = COMMAND_KEYWORDS.some((kw) =>
					messageContentLowerCase.includes(kw)
				);
			}
		}

		if (!debeResponder) return;

		await message.channel.sendTyping();

		logSeparator();
		console.log(
			`Mensaje recibido: "${message.content}" por ${
				message.author.username
			} en ${isDM ? "DM" : `canal ${message.channel.name}`} (ID: ${
				message.channel.id
			})`
		);

		const lowerCaseContent = message.content.toLowerCase();
		const isImageRequest =
			lowerCaseContent.includes("!imagine") ||
			lowerCaseContent.includes("genera");

		if (isImageRequest) {
			message.react("🎨");
			if (!IMAGE_MODEL_ID) {
				return message.reply(
					"No tengo configurado un modelo para generar imágenes. El admin necesita configurar `IMAGE_MODEL_ID`."
				);
			}
			const imagePrompt = message.content
				.replace(/!imagine/gi, "")
				.replace(/genera/gi, "")
				.trim();
			const headers = {
				"X-User-Id": message.author.username,
				"X-Channel-Id": `Canal de discord: ${message.channel.id}`,
			};
			const imageUrl = await callOpenRouterImageAPI(imagePrompt, headers);
			if (imageUrl) {
				await message.channel.send({ content: imageUrl });
			} else {
				await message.reply(
					"No pude generar la imagen. Algo salió mal. Intenta de nuevo más tarde."
				);
			}
			return; // Termina la ejecución para no continuar con la lógica de chat
		}

		if (lowerCaseContent.includes("!web")) {
			message.react("🛜");
		}

		const userId = message.author.id;
		const history = userConversations.get(userId) || [];

		history.push({
			role: "user", // Aunque es el usuario, para la API de OpenAI, el historial es parte del "user" prompt
			content: message.content,
			name: message.author.username, // Para referencia en el historial
			timestamp: message.createdTimestamp,
		});

		// Mantener solo los últimos 4 mensajes en el historial
		if (history.length > 4) {
			userConversations.set(userId, history.slice(-4));
		} else {
			userConversations.set(userId, history);
		}

		// Formatear el historial para el prompt
		const formattedHistory = history
			.map((msg) => {
				const date = new Date(msg.timestamp).toLocaleString("es-MX", {
					timeZone: "America/Mexico_City",
					hour12: true,
				});
				return `(${date}) ${msg.name}: ${msg.content}`; // Formato más legible
			})
			.join("\n"); // Unir con saltos de línea

		const image = message.attachments.find((att) =>
			att.contentType?.startsWith("image")
		);
		const audio = message.attachments.find((att) =>
			att.contentType?.startsWith("audio")
		);

		let effectiveModel = MODEL_ID;
		let apiUserContentPayload = [
			{
				type: "text",
				text: `Historial de conversación anterior con ${message.author.username}:\n${formattedHistory}\n\nMensaje actual de ${message.author.username}: ${message.content}`,
			},
		];

		if (image) {
			message.react("👀");
			apiUserContentPayload.push({
				type: "image_url",
				image_url: { url: image.url },
			});
		}

		if (audio) {
			message.react("🎧");
			if (!AUDIO_MODEL_ID) {
				return message.reply(
					"No tengo configurado un modelo para procesar audio. El admin necesita configurar `AUDIO_MODEL_ID`."
				);
			}
			effectiveModel = AUDIO_MODEL_ID; // Cambiamos al modelo de audio

			// Para modelos como Whisper, se envía el audio para transcripción.
			// La API de chat/completions de OpenRouter puede no soportar 'audio_url' directamente para todos los modelos.
			// La forma más compatible es transcribir primero y luego enviar el texto.
			// Aquí asumimos que el modelo puede manejar audio_url. Si no, necesitarías una llamada a /audio/transcriptions
			// y luego otra a /chat/completions con el texto.
			// Por simplicidad, lo añadimos al payload. Asegúrate que tu modelo lo soporte.
			try {
				const transcriptionResponse = await fetch(
					"https://openrouter.ai/api/v1/audio/transcriptions",
					{
						method: "POST",
						headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}` },
						body: JSON.stringify({ model: AUDIO_MODEL_ID, file: audio.url }), // Esto puede necesitar ajustes si la API espera un stream
					}
				);
				// La línea anterior es conceptual. La API de OpenRouter para audio puede requerir un `FormData` en lugar de JSON.
				// Por ahora, lo dejamos así y cambiamos el modelo para la respuesta de texto.
				// Si esto falla, la alternativa es usar un modelo multimodal que sí acepte audio_url en chat.
				apiUserContentPayload.push({
					type: "audio_url",
					audio_url: { url: audio.url },
				});
			} catch (e) {
				console.error(
					"Error al intentar preparar la transcripción de audio:",
					e
				);
				return message.reply("Tuve problemas para procesar el audio.");
			}
		}

		const apiMessages = [
			{ role: "system", content: BOT_PERSONA_PROMPT },
			{ role: "user", content: apiUserContentPayload },
		];
		apiMessages[0].content = apiMessages[0].content.replace(
			"MODEL_ID",
			effectiveModel
		); // Actualiza el modelo en el system prompt si es necesario
		const headers = {
			"X-User-Id": message.author.username,
			"X-Channel-Id": `Canal de discord: ${message.channel.id}`, // Usar ID del canal
		};

		const responseContent = await callOpenRouterAPI(apiMessages, headers, 500);

		if (responseContent) {
			logSeparator("-");
			console.log("Respuesta de la API:", responseContent);
			logSeparator();
			if (!message.replied) {
				// Evitar doble respuesta si algo ya lo hizo
				await message.channel.send({ content: responseContent });
			}
		} else {
			console.log(
				"No hubo respuesta de la API de OpenRouter para el mensaje del usuario."
			);
			if (!message.replied) {
				// Opcional: enviar un mensaje si la API no responde pero no hay error. DESCOMENTAR PARA PRUEBAS.
				message.reply(
					"No pude generar una respuesta de la API en este momento."
				);
			}
		}
	} catch (error) {
		// El error de la API ya se loguea en callShapesAPI
		console.error("Error en el manejador messageCreate:", error);
		if (!message.replied) {
			try {
				await message.reply(
					"¡Ups! Algo salió mal procesando tu mensaje. Intenta de nuevo más tarde."
				);
			} catch (replyError) {
				console.error(
					"Error al intentar enviar mensaje de error al usuario:",
					replyError
				);
			}
		}
	}
});

client.login(DISCORD_TOKEN);
