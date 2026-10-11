
# Customer State Design

The AI agent should track these details during each call.

## Customer Information

customer_verified = UNKNOWN
customer_available = UNKNOWN
customer_interested = UNKNOWN

## Eligibility Information

property_type = UNKNOWN
ownership_status = UNKNOWN
original_documents = UNKNOWN
loan_amount = UNKNOWN
occupation = UNKNOWN
income_mode = UNKNOWN
market_value = UNKNOWN
tenure = UNKNOWN

## Special Conditions

existing_property_loan = UNKNOWN
emi_reduction_request = UNKNOWN
callback_time = UNKNOWN
loan_amount_confirmation_pending = FALSE

## Final Status

qualification_status = IN_PROGRESS

Possible final statuses:
- QUALIFIED
- DISQUALIFIED
- LOAN_TRANSFER
- CALLBACK
- NOT_INTERESTED
- WRONG_PERSON

## Memory Rules

1. Capture all clearly stated customer information.
2. Do not ask questions that have already been answered.
3. If the customer corrects a previous answer, update the stored value.
4. Never guess unclear information.
5. Apply disqualification rules immediately.
6. Ask the first missing eligibility question.
7. Never hand off an incomplete qualification.

## Example

Customer says:

"I own a residential house jointly with my wife.
It is worth around 1 crore, and I need 50 lakh."

Save:

property_type = RESIDENTIAL
ownership_status = JOINT
market_value = 10000000
loan_amount = 5000000

The next missing question is about original documents.

## Implementation Note

This is a logical state design, not executable code.

During deployment, the system prompt and conversation
history will guide the AI's memory. We will test whether
the chosen voice-agent platform preserves these details
reliably across turns.
