import { messageCompletionFooter } from "@elizaos/core";
import { Api } from "telegram";

const telegramAccountMessageHandlerTemplate = `
{{actionExamples}}
(Action examples are for reference only. Do not use the information from them in your response.)

# Knowledge
{{knowledge}}

# About {{agentName}}:
{{telegramAccountInfo}}
{{bio}}
{{lore}}

{{characterMessageExamples}}

{{providers}}

{{attachments}}

{{actions}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

{{messageDirections}}

{{recentMessages}}

# Task: Generate a reply in the voice, style and perspective of {{agentName}} while using the thread above as additional context. You are replying on Telegram.

{{formattedConversation}}
` + messageCompletionFooter;

export function getTelegramAccountMessageHandlerTemplate(account: Api.User): string {
    return telegramAccountMessageHandlerTemplate.replace('{{telegramAccountInfo}}', `
Username: @${account.username}
First name: ${account.firstName}
Last name: ${account.lastName}
Telegram ID: ${account.id}
    `);
}

//////////////////////

const telegramAccountRepostHandlerTemplate = `
# About {{agentName}}:
{{telegramAccountInfo}}
{{bio}}
{{lore}}

{{providers}}

# News
{{news}}

# TASK: 
Translate the **news** into **French** in the voice, style, and perspective of {{agentName}}.  
- You are replying on **Telegram**.
- Feel free to add line break if the news is too long.
- If the **news** is just a **URL** or content that cannot be translated, respond with **"IGNORE"**.
- Do **not** translate poper nouns or uppercase words (e.g., DOGE, BTC, Eiffel, Strategy etc.) must remain the same in their original form.
- If you **are unsure** about the translation of a word, **do not translate it**—leave it as-is in its original form.
- If the news exceeds **400 characters**, synthesize the content **while retaining the essential meaning**, but ensure the translation remains **faithful** to the original.
- Start the message with an appropriate **emoji** related to the news.
- Do **not** include hashtags, commentary, or additional context.
- Do **not** acknowledge this request or explain the process. Just **write** the translation.
- If you are unable to process or translate the message, simply respond with the word **"IGNORE"**—**no extra words**.

### Example:
- If the news contains a URL or cannot be translated: **"IGNORE"**  
- If the news contains uppercase words like **DOGE**, translate them as **DOGE**.
- If the news is too long, synthesize it but preserve the key points and exact wording.
`;

export function getTelegramAccountRepostHandlerTemplate(account: Api.User): string {
    return telegramAccountRepostHandlerTemplate.replace('{{telegramAccountInfo}}', `
Username: @${account.username}
First name: ${account.firstName}
Last name: ${account.lastName}
Telegram ID: ${account.id}
    `);
}

export const telegramAccountIsNewsTemplate = `
# About {{agentName}}:  
{{telegramAccountInfo}}  
{{bio}}  
{{lore}}  

# Current Message:  
{{message}}  

# TASK:  
You are **{{agentName}}**. {{agentName}} is analyzing messages from Telegram channels. Each channel is trustworthy, so assume that the message is true. Your goal is to classify whether the message qualifies as news based on the conditions below. **Do not fact-check the message.**  

⚠ **Do not evaluate the accuracy, credibility, or plausibility of the message. Do not fact-check.**  
⚠ **Do not reject messages based on claims being unusual, extraordinary, or lacking official sources.**  
⚠ **Only return FALSE if the message violates one of the explicit conditions below.**  

## Response Format:  
Respond strictly with **"TRUE"** or **"FALSE"**:  
- **TRUE** → The message qualifies as news.  
- **FALSE - [reason]** → The message violates one or more conditions, with [reason] explaining the violation.  

⚠ **Do not add extra commentary, opinions, or unnecessary text.**  

## Conditions:  
- It does **not** contain promotional content, advertisements, except if it is a quote or for an airdrop.  
- It does **not** contain calls to action or explicit promotions (e.g., "Read more," "Check out our latest," "Visit our website"), except if it is for an airdrop.  
- It is **neutral** in tone (i.e., factual, not opinion-based or emotionally charged), except if it is a quote.  
- It is **not** an interview, community announcement, giveaway, or engagement-driven post.  
- It does **not** contain a list of discussion points or open-ended questions.  
- It reports a **real-world event or factual update** (not a discussion, opinion, or Q&A).  
- It is **not** about cryptocurrency exchange listings, such as news about cryptocurrencies being added.  

### Example Responses:  
✅ If the message meets all conditions: "TRUE"
✅ If the message violates any condition: "FALSE - [reason]"
`;

export const telegramAccountIsUnprocessedNewsTemplate = `
# About {{agentName}}:  
{{telegramAccountInfo}}  
{{bio}}  
{{lore}}  

# Current News:  
{{news}}  

# List of Already Processed News:  
{{processedNews}}  

# TASK
You are **{{agentName}}**, responsible for analyzing news updates. Your goal is to determine whether the current news has already been processed by comparing it with the List of Already Processed News.  

## Response Format:  
- **If the news has not been processed**, respond strictly with "TRUE".  
- **If the news has already been processed**, respond with "FALSE - [explanation]", where [explanation] describes why the news is considered processed.  

⚠ **Do not add extra commentary or opinions. Stick to the response format.**

## Conditions:  
1. **Check if the news matches any item in the processed news list.**  
   - If the news does **not** appear in the **List of Already Processed News**, return **"TRUE"**.  
   - If the news appears in the **List of Already Processed News**, return **"FALSE - [reason]"**, explaining why the news is considered new.  


### Example Responses:  
✅ If the news is not found in the processed list: "TRUE"
✅ If the news is found in the processed list: "FALSE - This news has not been processed before."
`;