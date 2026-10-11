
const QUESTIONS = {
  propertyType:
    "What type of property do you have: residential, commercial, industrial, or agricultural?",

  ownership:
    "Is the property owned solely by you or jointly with someone?",

  originalDocuments:
    "Do you have the original property documents available for verification?",

  loanAmount:
    "Approximately how much loan amount are you looking for?",

  occupation:
    "Are you salaried or self-employed?",

  incomeMode:
    "Do you receive your income through a bank account, or is it cash-only?",

  marketValue:
    "What is the approximate current market value of your property?",

  tenure:
    "What loan tenure would you prefer, between 3 and 15 years?",
};

const FIELDS = [
  "propertyType",
  "ownership",
  "originalDocuments",
  "loanAmount",
  "occupation",
  "incomeMode",
  "marketValue",
  "tenure",
];

function createState() {
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
    status: "active",
  };
}

function applyFacts(state, facts) {
  const allowed = [
    "identity",
    "availability",
    "interest",
    "existingLoan",
    "emiReduction",
    "callbackTime",
    ...FIELDS,
    "loanCapAccepted",
  ];

  for (const field of allowed) {
    if (
      Object.prototype.hasOwnProperty.call(facts, field) &&
      facts[field] !== null &&
      facts[field] !== undefined
    ) {
      state[field] = facts[field];
    }
  }
}

function decideNext(state) {
  if (state.status !== "active") {
    return {
      status: state.status,
      reply: "This conversation has already ended.",
    };
  }

  if (state.identity === false) {
    return {
      status: "ended",
      reply:
        "I'm sorry for the inconvenience. I won't discuss any account details. Thank you for your time.",
    };
  }

  if (state.identity !== true) {
    return {
      status: "active",
      reply:
        "May I confirm that I'm speaking with Rahul Sharma?",
    };
  }

  if (state.availability === false) {
    if (!state.callbackTime) {
      return {
        status: "active",
        reply:
          "Of course. What day and time would be convenient for a callback?",
      };
    }

    return {
      status: "callback",
      reply:
        `Thank you. I've noted ${state.callbackTime} as your preferred callback time for this demonstration. Have a good day.`,
    };
  }

  if (state.availability !== true) {
    return {
      status: "active",
      reply:
        "Is this a convenient time for a brief conversation?",
    };
  }

  if (state.interest === false) {
    return {
      status: "not_interested",
      reply:
        "No problem at all. Thank you for your time, and have a good day.",
    };
  }

  if (state.interest !== true) {
    return {
      status: "active",
      reply:
        "In this demonstration, you have a pre-approved Loan Against Property offer of up to seventy-five lakh rupees, subject to eligibility and verification. Would you like to know more?",
    };
  }

  if (
    state.existingLoan === true ||
    state.emiReduction === true
  ) {
    return {
      status: "transfer",
      reply:
        "Since you already have a loan against the property or want to reduce your EMI, a loan-transfer specialist would be the right person to assist you. I can note your interest for a specialist follow-up in this demonstration. Thank you for your time.",
    };
  }

  if (
    state.existingLoan === null &&
    state.emiReduction === null
  ) {
    return {
      status: "active",
      reply:
        "Do you already have a loan against this property, or are you looking to reduce an existing EMI?",
    };
  }

  if (
    state.existingLoan === null ||
    state.emiReduction === null
  ) {
    return {
      status: "active",
      reply:
        "Just to confirm, are you looking for a new loan rather than an existing-loan transfer or EMI reduction?",
    };
  }

  if (state.propertyType === "agricultural") {
    return {
      status: "disqualified",
      reply:
        "Thank you for clarifying. Unfortunately, agricultural property is not eligible under this particular offer. I appreciate your time.",
    };
  }

  if (!state.propertyType) {
    return {
      status: "active",
      reply: QUESTIONS.propertyType,
    };
  }

  if (!state.ownership) {
    return {
      status: "active",
      reply: QUESTIONS.ownership,
    };
  }

  if (state.originalDocuments === false) {
    return {
      status: "disqualified",
      reply:
        "Thank you for confirming. Original property documents are required for verification under this offer, so we can't proceed at this stage.",
    };
  }

  if (state.originalDocuments !== true) {
    return {
      status: "active",
      reply: QUESTIONS.originalDocuments,
    };
  }

  if (state.loanAmount === null) {
    return {
      status: "active",
      reply: QUESTIONS.loanAmount,
    };
  }

  if (state.loanAmount > 7500000) {
    if (state.loanCapAccepted === false) {
      return {
        status: "disqualified",
        reply:
          "I understand. This offer has a maximum limit of seventy-five lakh rupees, so we can't proceed with your requested amount. Thank you for your time.",
      };
    }

    if (state.loanCapAccepted !== true) {
      return {
        status: "active",
        reply:
          "The maximum available under this offer is seventy-five lakh rupees. Would you like to continue with that amount instead?",
      };
    }
  }

  if (!state.occupation) {
    return {
      status: "active",
      reply: QUESTIONS.occupation,
    };
  }

  if (state.incomeMode === "cash_only") {
    return {
      status: "disqualified",
      reply:
        "Thank you for explaining. Income received through a bank account is required under this offer, so we won't be able to proceed with cash-only income.",
    };
  }

  if (!state.incomeMode) {
    return {
      status: "active",
      reply: QUESTIONS.incomeMode,
    };
  }

  if (state.marketValue === null) {
    return {
      status: "active",
      reply: QUESTIONS.marketValue,
    };
  }

  if (state.tenure !== null) {
    if (state.tenure < 3 || state.tenure > 15) {
      return {
        status: "disqualified",
        reply:
          "Thank you for sharing your preference. This particular offer supports a tenure between three and fifteen years, so your requested tenure falls outside the available range.",
      };
    }
  }

  if (state.tenure === null) {
    return {
      status: "active",
      reply: QUESTIONS.tenure,
    };
  }

  return {
    status: "qualified",
    reply:
      "Thank you. Based on the information you've shared, you meet the initial screening criteria for this offer. A senior loan expert can explain the applicable interest rate, documentation, and next steps. This is not a guarantee of final loan approval.",
  };
}

module.exports = {
  createState,
  applyFacts,
  decideNext,
};
