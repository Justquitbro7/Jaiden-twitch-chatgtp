let infoCanal = ""; // Variable compartida

// Exportar las funciones para obtener y actualizar infoCanal
export const getInfoCanal = () => infoCanal;

export const setInfoCanal = (newInfoCanal) => {
    infoCanal = newInfoCanal;
};

export let apiKey = process.env.OPENAI_API_KEY;

export function setApiKey(newKey) {
    apiKey = newKey;
}

let userId = null;

export function setUserId(id) {
  userId = id;
}
export function getUserId() {
  return userId;
}

let channelId = null;

export function setChannelId(id) {
  channelId = id;
}

export function getChannelId() {
  return channelId;
}
