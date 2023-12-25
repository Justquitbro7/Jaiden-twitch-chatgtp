import express from 'express';
import fs from 'fs';
import { OpenAIOperations } from './openai_operations.js';
import { TwitchBot } from './twitch_bot.js';
import { job } from './keep_alive.js';
import expressWs from 'express-ws';
import ws from 'ws';

// start keep alive cron job
job.start();
console.log(process.env);

// setup express app
const app = express();
const expressWsInstance = expressWs(app);

// set the view engine to ejs
app.set('view engine', 'ejs');

// load env variables
let GPT_MODE = process.env.GPT_MODE;
let HISTORY_LENGTH = process.env.HISTORY_LENGTH;
let OPENAI_API_KEY = process.env.OPENAI_API_KEY;
let MODEL_NAME = process.env.MODEL_NAME;
let TWITCH_USER = process.env.TWITCH_USER;
let TWITCH_AUTH = process.env.TWITCH_AUTH;
let COMMAND_NAME = process.env.COMMAND_NAME;
let CHANNELS = process.env.CHANNELS;

if (!GPT_MODE) {
    GPT_MODE = "CHAT";
}
// Add similar checks for other variables...

// init global variables
const MAX_LENGTH = 399;
let file_context = "You are a helpful Twitch Chatbot.";
let last_user_message = "";

// setup twitch bot
const channels = CHANNELS ? CHANNELS.split(",") : ["oSetinhas", "jones88"];
const channel = channels[0];
console.log("Channels: " + channels);

const bot = new TwitchBot(TWITCH_USER || "oSetinhasBot", TWITCH_AUTH || "oauth:vgvx55j6qzz1lkt3cwggxki1lv53c2", channels);

// setup openai operations
file_context = fs.readFileSync("./file_context.txt", 'utf8');
const openai_ops = new OpenAIOperations(file_context, OPENAI_API_KEY || "", MODEL_NAME || "gpt-3.5-turbo", HISTORY_LENGTH || 5);

// setup twitch bot callbacks
bot.onConnected((addr, port) => {
    console.log(`* Connected to ${addr}:${port}`);
    // join channels
    channels.forEach(channel => {
        console.log(`* Joining ${channel}`);
        console.log(`* Saying hello in ${channel}`);
    });
});

// connect bot
bot.connect(
    () => {
        console.log("Bot connected!");
    },
    (error) => {
        console.log("Bot couldn't connect!");
        console.log(error);
    }
);

bot.onMessage(async (channel, user, message, self) => {
    if (self) return;

    // check if message is a command started with !COMMAND_NAME (e.g. !gpt)
    if (message.startsWith("!" + COMMAND_NAME)) {
        // get text
        const text = message.slice(COMMAND_NAME.length + 1);

        // make openai call
        const response = await openai_ops.make_openai_call(text);

        // merge split response function
        const answer_question = async (answer) => {
            if (answer.length > MAX_LENGTH) {
                const messages = answer.match(new RegExp(`.{1,${MAX_LENGTH}}`, "g"));
                messages.forEach((message, index) => {
                    setTimeout(() => {
                        bot.say(channel, message);
                    }, 1000 * index);
                });
            } else {
                bot.say(channel, answer);
                try {
                    console.log(user.username + ' - ' + user.userstate);
                    const ttsAudioUrl = await bot.sayTTS(channel, answer, user.userstate);
                    // Notify clients about the file change
                    notifyFileChange(ttsAudioUrl);
                } catch (error) {
                    console.error(error);
                }
            }
        };

        // send response
        await answer_question(response);
    }
});

// Other code...

// Notify clients when the file changes
function notifyFileChange() {
    wss.clients.forEach((client) => {
        if (client.readyState === ws.OPEN) {
            client.send(JSON.stringify({ updated: true }));
        }
    });
}

// make app always listening to twitch chat and get new messages starting with !gpt on port 3000
const server = app.listen(3000, () => {
    console.log('Server running on port 3000');
});

const wss = expressWsInstance.getWss();

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        // Handle client messages (if needed)
    });
});
