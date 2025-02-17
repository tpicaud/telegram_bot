import { messageCompletionFooter } from "@elizaos/core";
import {Api} from "telegram";

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

{{characterMessageExamples}}

{{providers}}

{{actions}}

{{messageDirections}}

# News
{{news}}

# Task: Translate the News in french in the voice, style and perspective of {{agentName}}. You are replying on Telegram.
If the news is just a url, or a content that you cannot translate, response must be 'IGNORE'.
Do not add any context, just translate the news. If the news is more than 400 characters, you are allowed to synthesize it
Start the message with an appropriate emojis.
No hashtags.
Do not add commentary or acknowledge this request, just write the response.
If the response is 'IGNORE', just response with 'IGNORE' word. Do NOT add any other words or sentence.
`;

export function getTelegramAccountRepostHandlerTemplate(account: Api.User): string {
    return telegramAccountRepostHandlerTemplate.replace('{{telegramAccountInfo}}', `
Username: @${account.username}
First name: ${account.firstName}
Last name: ${account.lastName}
Telegram ID: ${account.id}
    `);
}

export const telegramAccountIsNewNewsTemplate = `
# About {{agentName}}:
{{telegramAccountInfo}}
{{bio}}
{{lore}}

# TASK: You are {{agentName}}. {{agentName}} is getting news from Telegram channels. Determine if the current news is already processed. Do not comment. Just respond with "TRUE" or "FALSE".

# Current News:
{{news}}

# List of already processed news :
{{processedNews}}
`;