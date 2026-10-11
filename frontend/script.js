
const startBtn = document.getElementById("startBtn");
const micBtn = document.getElementById("micBtn");
const stopBtn = document.getElementById("stopBtn");
const resetBtn = document.getElementById("resetBtn");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("messages");
const statusBox = document.getElementById("status");

const downloadBtn =
  document.getElementById("downloadBtn");

const eligibilityStatus =
  document.getElementById("eligibilityStatus");

let conversationEnded = false;

let sessionId = null;
let waiting = false;
let listening = false;
let speaking = false;
let recognition = null;

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

const synth = window.speechSynthesis;

function setStatus(text) {
  statusBox.textContent = text;
}


function updateButtons() {
  startBtn.disabled = !!sessionId || waiting;

  micBtn.disabled =
    !sessionId ||
    conversationEnded ||
    waiting ||
    speaking ||
    listening ||
    !SpeechRecognition;

  sendBtn.disabled =
    !sessionId || conversationEnded || waiting;

  messageInput.disabled =
    !sessionId || conversationEnded || waiting;

  stopBtn.disabled = !speaking && !listening;

  downloadBtn.disabled = !sessionId;
}

function addMessage(role, text) {
  const item = document.createElement("div");
  item.className = `message ${role}`;

  const label = document.createElement("strong");
  label.textContent =
    role === "agent" ? "Ananya" : "Customer";

  const body = document.createElement("span");
  body.textContent = text;

  item.append(label, body);
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

function stopAudio() {
  if (recognition && listening) {
    recognition.abort();
    listening = false;
  }

  if (synth) {
    synth.cancel();
  }

  speaking = false;
  updateButtons();
}

function speak(text) {
  if (!synth || !window.SpeechSynthesisUtterance) {
    setStatus("Voice output unavailable. Read the reply.");
    return;
  }

  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang = "en-IN";
  utterance.rate = 0.95;
  utterance.pitch = 1;

  const voices = synth.getVoices();

  const indianVoice = voices.find(
    voice => voice.lang.toLowerCase() === "en-in"
  );

  if (indianVoice) {
    utterance.voice = indianVoice;
  }

  utterance.onstart = () => {
    speaking = true;
    setStatus("Ananya is speaking...");
    updateButtons();
  };

  utterance.onend = () => {
    speaking = false;
    setStatus("Ready for your response");
    updateButtons();
  };

  utterance.onerror = () => {
    speaking = false;
    setStatus("Voice output unavailable. Read the reply.");
    updateButtons();
  };

  synth.speak(utterance);
}

async function startConversation() {
  if (sessionId || waiting) return;

  waiting = true;
  setStatus("Starting conversation...");
  updateButtons();

  try {
    const response = await fetch("/session", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Unable to create session.");
    }

    const data = await response.json();

    sessionId = data.sessionId;
    messages.innerHTML = "";
    
conversationEnded = false;
eligibilityStatus.textContent = "Eligibility: Active";
eligibilityStatus.className = "eligibility-status";


    addMessage("agent", data.greeting);
    setStatus("Conversation started");
    speak(data.greeting);

  } catch (error) {
    setStatus(error.message);
  } finally {
    waiting = false;
    updateButtons();
  }
}

async function sendMessage(text) {
  const message = text.trim();

  if (!sessionId || !message || waiting) return;

  stopAudio();

  waiting = true;
  updateButtons();

  addMessage("customer", message);
  messageInput.value = "";
  setStatus("Ananya is thinking...");

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    addMessage("agent", data.reply);
    
const status = data.status || "active";

eligibilityStatus.textContent =
  `Eligibility: ${status.replaceAll("_", " ")}`;

eligibilityStatus.className =
  `eligibility-status ${status}`;

if (status !== "active") {
  conversationEnded = true;
}

    speak(data.reply);

  } catch (error) {
    setStatus(error.message);
    addMessage(
      "agent",
      "The request failed. Please try again."
    );
  } finally {
    waiting = false;
    updateButtons();
  }
}

function setupRecognition() {
  if (!SpeechRecognition) {
    setStatus(
      "Microphone speech recognition is unavailable. Use text input."
    );
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening = true;
    setStatus("Listening... please speak");
    updateButtons();
  };

  recognition.onresult = (event) => {
    const transcript =
      event.results[0][0].transcript;

    messageInput.value = transcript;
    listening = false;
    updateButtons();

    sendMessage(transcript);
  };

  recognition.onerror = (event) => {
    listening = false;
    setStatus(`Microphone error: ${event.error}`);
    updateButtons();
  };

  recognition.onend = () => {
    listening = false;
    updateButtons();
  };
}

async function resetConversation() {
  stopAudio();

  const oldSessionId = sessionId;
  sessionId = null;
  
conversationEnded = false;
eligibilityStatus.textContent =
  "Eligibility: Not started";
eligibilityStatus.className = "eligibility-status";

  messages.innerHTML = "";
  messageInput.value = "";

  setStatus("Ready to start");
  updateButtons();

  if (oldSessionId) {
    try {
      await fetch(
        `/session/${encodeURIComponent(oldSessionId)}`,
        { method: "DELETE" }
      );
    } catch (error) {
      console.warn("Session cleanup failed.");
    }
  }
}

startBtn.addEventListener(
  "click",
  startConversation
);

micBtn.addEventListener("click", () => {
  if (!recognition || !sessionId || waiting) return;

  if (synth) synth.cancel();
  speaking = false;

  try {
    recognition.start();
  } catch (error) {
    setStatus("Microphone could not start.");
  }
});

stopBtn.addEventListener("click", () => {
  stopAudio();
  setStatus("Stopped. Ready for your response.");
});

resetBtn.addEventListener(
  "click",
  resetConversation
);

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(messageInput.value);
});

setupRecognition();
updateButtons();

downloadBtn.addEventListener("click", () => {
  if (!sessionId) return;

  const url =
    `/session/${encodeURIComponent(sessionId)}/transcript`;

  const link = document.createElement("a");
  link.href = url;
  link.download = "voice-agent-transcript.txt";

  document.body.appendChild(link);
  link.click();
  link.remove();
});
