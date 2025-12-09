# AI Twitch Bot Documentation

Tu apoyo significa el mundo para mí ❤️

☕ [Apóyame con una donación](https://streamelements.com/araxielfenix/tip) ☕

Únete a nuestra comunidad de Discord:

[https://discord.gg/mE5mQfu](https://discord.gg/mE5mQfu)

---

## Overview

Este es un chatbot sencillo hecho en Node.js con integración de ChatGPT/OpenRouter, diseñado para trabajar con streams de Twitch. Utiliza el framework Express y puede operar en dos modos: modo chat (con contexto de mensajes previos) o modo prompt (sin contexto).

## Features

- Responde a comandos de chat de Twitch con respuestas generadas por ChatGPT/OpenRouter.
- Puede operar en modo chat con contexto o en modo prompt sin contexto.
- Soporte para respuestas con texto a voz (TTS).
- Personalizable mediante variables de entorno.
- Implementado en Render para disponibilidad 24/7.

---

## Setup Instructions

### 1. Haz un Fork del Repositorio

Inicia sesión en GitHub y haz un fork de este repositorio para obtener tu propia copia.

### 2. Llena tu Archivo de Contexto

Abre `file_context.txt` y escribe toda la información de contexto que quieras incluir en cada solicitud de GPT.

### 3. Crea una Cuenta en OpenAI

Crea una cuenta en [OpenAI](https://platform.openai.com) y configura límites de facturación si es necesario.

### 4. Obtén tu Clave API de OpenAI

Genera una clave API en la [página de claves API](https://platform.openai.com/account/api-keys) y guárdala de forma segura.

### 5. Implementa en Render

Render te permite ejecutar tu bot 24/7 de manera gratuita. Sigue estos pasos:

#### 5.1. Implementar en Render

Haz clic en el botón de abajo para implementar:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

#### 5.2. Inicia Sesión con GitHub

Inicia sesión con tu cuenta de GitHub y selecciona tu repositorio fork para la implementación.

### 6. Configura las Variables de Entorno

Ve a la pestaña de variables/entorno en tu implementación de Render y configura las siguientes variables:

#### 6.1. Variables Requeridas

- `OPENAI_API_KEY`: Tu clave API de OpenAI.

#### 6.2. Variables Opcionales

##### 6.2.1. Variable de Integración con Nightbot/Streamelements
- `GPT_MODE`: (por defecto: `CHAT`) Modo de operación, puede ser `CHAT` o `PROMPT`.

##### 6.2.2. Variables para Todos los Modos
- `HISTORY_LENGTH`: (por defecto: `5`) Número de mensajes previos a incluir en el contexto.
- `MODEL_NAME`: (por defecto: `gpt-3.5-turbo`) El modelo de OpenAI a usar. Puedes revisar los modelos disponibles [aquí](https://platform.openai.com/docs/models). 
- `COMMAND_NAME`: (por defecto: `!gpt`) El comando que activa el bot. Puedes configurar más de un comando separándolos con comas (e.g., `!gpt,!chatbot`).
- `CHANNELS`: Lista de canales de Twitch en los que el bot participará (separados por comas). (e.g., `canal1,canal2`; no incluyas www.twitch.tv)
- `SEND_USERNAME`: (por defecto: `true`) Si se incluye el nombre de usuario en el mensaje enviado a OpenAI.
- `ENABLE_TTS`: (por defecto: `false`) Si se habilita Texto a Voz.
- `ENABLE_CHANNEL_POINTS`: (por defecto: `false`) Si se habilita la integración de puntos del canal.
- `COOLDOWN_DURATION`: (por defecto: `10`) Duración en segundos del tiempo de enfriamiento entre respuestas.

#### 6.3. Variables de Integración con Twitch

- `TWITCH_AUTH`: Token OAuth para tu bot de Twitch.
  - Ve a https://twitchapps.com/tmi/ y haz clic en "Connect with Twitch".
  - Copia el token de la página y pégalo en la variable `TWITCH_AUTH`.
  - ⚠️ ESTE TOKEN PUEDE EXPIRAR EN UNOS DÍAS, ASÍ QUE PODRÁS NECESITAR REPETIR ESTE PASO ⚠️.

### 7. Configuración de Texto a Voz (TTS)

Tu URL de Render (e.g., `https://tu-bot-de-twitch.onrender.com/`) puede ser agregada como un widget a tu stream para integración de TTS.

---

## Usage

### Comandos

Puedes interactuar con el bot usando comandos en el chat de Twitch. Por defecto, el comando es `!gpt`. Puedes cambiarlo en las variables de entorno.

### Ejemplo

Para usar el comando `!gpt`:

```twitch
!gpt ¿Cómo estará el clima hoy?
