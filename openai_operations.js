import { getInfoCanal } from "./sharedData.js";
import { getUserId } from "./sharedData.js";
import { setChannelId, getChannelId } from "./sharedData.js";
import dotenv from "dotenv";
import { OpenAI } from "openai";
dotenv.config();

export class OpenAIOperations {
	constructor(file_context, history_length) {
		this.fileContext = file_context;
		this.history_length = history_length;
		this.messages = [{ role: "system", content: `${file_context}` }];

		// OpenAI/OpenRouter API keys
		this.apiKey1 = process.env.OPENAI_API_KEY_1;
		this.apiKey2 = process.env.OPENAI_API_KEY_2;
		this.currentApiKey = 1;
		this.apiKey = this.apiKey1;
		this.model_name = process.env.MODEL_NAME; // Usarás esto para ambos proveedores

		if (!this.apiKey1 && !this.apiKey2) {
			console.error(
				"No se encontraron las API keys. Por favor, configúralas como variables de entorno."
			);
		}
		if (!this.model_name) {
			console.error("No se encontró la MODEL_NAME. Por favor, configúrala.");
		}
	}

	// Alternancia de API key de OpenAI/OpenRouter
	toggleApiKey() {
		if (this.currentApiKey === 1 && this.apiKey2) {
			this.currentApiKey = 2;
			this.apiKey = this.apiKey2;
			console.log("Cambiando a la segunda API key");
		} else if (this.currentApiKey === 2 && this.apiKey1) {
			this.currentApiKey = 1;
			this.apiKey = this.apiKey1;
			console.log("Cambiando a la primera API key");
		}
	}

	check_history_length() {
		if (this.messages.length > this.history_length * 2 + 1) {
			this.messages.splice(1, 2);
		}
	}

	// Llamada a OpenRouter (o OpenAI compatible)
	async make_openrouter_call(text) {
		const maxRetries = 3;
		let attempts = 0;

		while (attempts < maxRetries) {
			try {
				const infoCanal = getInfoCanal();
				const formattedText = `${infoCanal}\n${text}`;
				this.messages.push({ role: "user", content: formattedText });

				this.check_history_length();

				const response = await fetch(
					"https://openrouter.ai/api/v1/chat/completions",
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${this.apiKey}`,
							"HTTP-Referer": process.env.YOUR_SITE_URL || "",
							"X-Title": process.env.YOUR_SITE_NAME || "",
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							model: this.model_name,
							messages: this.messages,
							temperature: 0.8,
							max_tokens: 65,
							frequency_penalty: 0.6,
							presence_penalty: 0.6,
						}),
					}
				);

				if (!response.ok) {
					console.error(
						`HTTP Error: ${response.status} - ${response.statusText}`
					);
					if (response.status === 401) {
						console.log("API key inválida. Cambiando a una nueva API key...");
						this.toggleApiKey();
						continue;
					} else {
						throw new Error(`HTTP Error: ${response.status}`);
					}
				}

				const data = await response.json();

				if (data.choices && data.choices[0].message) {
					const agent_response = data.choices[0].message.content;
					this.messages.push({ role: "assistant", content: agent_response });
					return agent_response;
				} else {
					console.error("Unexpected response from OpenRouter:", data);
					throw new Error("No choices returned from OpenRouter");
				}
			} catch (error) {
				console.error("Error during OpenRouter call:", error);
				attempts += 1;
				if (attempts >= maxRetries) {
					return "Tuve un problema para entender tu mensaje, por favor intenta más tarde.";
				}
			}
		}
	}
}
