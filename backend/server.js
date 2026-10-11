
require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { GoogleGenAI } = require("@google/genai");

const {
  createState,
  applyFacts,
  decideNext,
} = require("./eligibility");

const app = express();
const PORT = Number(process.env.PORT) || 3001;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const sessions = new Map();

app.use(express.json({ limit: "32kb" }));

app.use(express.static(
  path.join(__dirname, "..", "frontend")
));

const GREETING =
  "Hello, may I speak with Rahul Sharma?";

function createSession() {
  return {
    state: createState(),
    transcript: [
      { role: "agent", text: GREETING }
    ],
    busy: false,
  };
}

const extractionInstructions = `
You are a structured information extractor for
a fictional loan qualification conversation.

Return ONLY one JSON object.

Extract facts explicitly stated or clearly corrected
in the customer's latest message.

Use the previous agent question and the current
conversation state to interpret short replies.

Allowed fields and values:

identity: true | false | null
availability: true | false | null
interest: true | false | null
existingLoan: true | false | null
emiReduction: true | false | null
callbackTime: string | null

propertyType:
"residential" | "commercial" |
"industrial" | "agricultural" | null

ownership: "sole" | "joint" | null

originalDocuments: true | false | null

loanAmount: number | null
occupation: "salaried" | "self_employed" | null
incomeMode: "bank" | "cash_only" | null
marketValue: number | null
tenure: number | null
loanCapAccepted: true | false | null

All money values must be in Indian rupees:
50 lakh = 5000000
75 lakh = 7500000
1 crore = 10000000

Tenure must be in years:
60 months = 5 years

Use null for anything not established in the
latest message. Do not invent information.

Do not interpret "yes" as agreement with every
question in the conversation. Interpret it only
against the latest agent question.

If the customer says they want a new loan
rather than an existing-loan transfer or
EMI reduction, set existingLoan=false
and emiReduction=false.

If the customer explicitly corrects an earlier
fact, return the new value.

If the customer merely asks a question,
do not invent an answer.

Return every field in the JSON object.
`;

function blankFacts() {
  return {
    identity: null,
    availability: null,
    interest: null,
    existingLoan: null,
    emiReduction: null,
    callbackTime: null,
    propertyType: null,
    ownership: null,
    originalDocuments: null,
    loanAmount: null,
    occupation: null,
    incomeMode: null,
    marketValue: null,
    tenure: null,
    loanCapAccepted: null,
  };
}

function normalizeFacts(raw) {
  const facts = blankFacts();

  const booleans = [
    "identity",
    "availability",
    "interest",
    "existingLoan",
    "emiReduction",
    "originalDocuments",
    "loanCapAccepted",
  ];

  for (const key of booleans) {
    if (typeof raw[key] === "boolean") {
      facts[key] = raw[key];
    }
  }

  const options = {
    propertyType: [
      "residential",
      "commercial",
      "industrial",
      "agricultural",
    ],
    ownership: ["sole", "joint"],
    occupation: ["salaried", "self_employed"],
    incomeMode: ["bank", "cash_only"],
  };

  for (const [key, values] of Object.entries(options)) {
    if (values.includes(raw[key])) {
      facts[key] = raw[key];
    }
  }

  for (const key of [
    "loanAmount",
    "marketValue",
    "tenure",
  ]) {
    if (
      typeof raw[key] === "number" &&
      Number.isFinite(raw[key]) &&
      raw[key] > 0
    ) {
      facts[key] = raw[key];
    }
  }

  if (
    typeof raw.callbackTime === "string" &&
    raw.callbackTime.trim()
  ) {
    facts.callbackTime = raw.callbackTime.trim();
  }

  return facts;
}

async function extractFacts(message, session) {
  const lastAgentMessage = [...session.transcript]
    .reverse()
    .find(item => item.role === "agent")?.text || "";

  const input = {
    previousAgentQuestion: lastAgentMessage,
    currentState: session.state,
    customerMessage: message,
  };

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: JSON.stringify(input),
    config: {
      systemInstruction: extractionInstructions,
      responseMimeType: "application/json",
      temperature: 0,
      maxOutputTokens: 700,
    },
  });

  const raw = JSON.parse(response.text);
  return normalizeFacts(raw);
}

function checkSensitiveData(message) {
  return /\b(?:otp|one.time.password|cvv|password)\b/i
    .test(message);
}

function makeTranscript(session) {
  const lines = [
    "SALESAGENTS AI — VOICE AGENT TEST",
    "Fictional Home Credit LAP demonstration",
    "",
  ];

  for (const item of session.transcript) {
    const speaker =
      item.role === "agent" ? "Ananya" : "Customer";

    lines.push(`${speaker}: ${item.text}`);
    lines.push("");
  }

  lines.push(`Final status: ${session.state.status}`);

  return lines.join("\n");
}

app.post("/session", (req, res) => {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, createSession());

  res.json({
    sessionId,
    greeting: GREETING,
  });
});

app.post("/chat", async (req, res) => {
  const { sessionId, message } = req.body || {};

  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(400).json({
      error: "Invalid session. Start a new conversation.",
    });
  }

  if (
    typeof message !== "string" ||
    !message.trim() ||
    message.length > 2000
  ) {
    return res.status(400).json({
      error: "Please enter a valid message.",
    });
  }

  if (session.busy) {
    return res.status(409).json({
      error: "Previous request is still processing.",
    });
  }

  if (session.state.status !== "active") {
    return res.status(409).json({
      error: "Conversation has ended. Start a new session.",
      ended: true,
    });
  }

  session.busy = true;

  try {
    let result;

    if (checkSensitiveData(message)) {
      result = {
        status: "active",
        reply:
          "For your security, please don't share passwords, OTPs, or CVV details. We don't need those for this conversation. Could we continue with the previous question?",
      };
    } else {
      const facts = await extractFacts(message, session);

      applyFacts(session.state, facts);
      result = decideNext(session.state);

      session.state.status = result.status;
    }

    session.transcript.push(
      { role: "customer", text: message.trim() },
      { role: "agent", text: result.reply }
    );

    res.json({
      reply: result.reply,
      status: session.state.status,
      state: session.state,
    });

  } catch (error) {
    console.error("Gemini error:", error.message);

    res.status(500).json({
      error:
        "Could not process the answer. Please retry.",
    });
  } finally {
    session.busy = false;
  }
});

app.get("/session/:id/transcript", (req, res) => {
  const session = sessions.get(req.params.id);

  if (!session) {
    return res.status(404).json({
      error: "Session not found.",
    });
  }

  res.setHeader(
    "Content-Type",
    "text/plain; charset=utf-8"
  );

  res.setHeader(
    "Content-Disposition",
    'attachment; filename="voice-agent-transcript.txt"'
  );

  res.send(makeTranscript(session));
});

app.delete("/session/:id", (req, res) => {
  sessions.delete(req.params.id);
  res.json({ success: true });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(
    `Voice agent running at http://localhost:${PORT}`
  );
});
