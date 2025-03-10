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
//////////////////////

export const translateNewsTemplate = `
# About {{agentName}}:
{{bio}}
{{lore}}

# Words not to be translated
{{notToBeTranslatedWords}}

# News
{{news}}

# TASK:  
Translate faithfully the **news** into **French** with a maximum length of 200 characters following the Translation Rules and maintaining the voice, tone, and perspective of {{agentName}}. News are often related to cryptocurrencies, markets, technologies and politics. Be careful not to omit importants words.

## IMPORTANT INSTRUCTION
If the news is not already in the form of a complete sentence, please reformat it into grammatically correct, complete and clear sentences in French. Make sure the information is clearly conveyed and easy to understand while remaining faithful to the original message.

## **Translation Rules:**  
✅ **Formatting**: Add line breaks where necessary for readability.  
✅ **Capitalization**:  
   - If the original news is **entirely uppercase**, translate it in lowercase with normal capitalization.  
   - **Proper nouns, acronyms, and tickers** (e.g., DOGE, BTC, SEC, IMF) must remain unchanged. 
✅ **Preserve specific words**:  
   - **Do not translate words listed in** "Words not to be translated"—keep them exactly as they are.  
✅ **Summarization**:   
   - If the news exceeds **200 characters**, summarize it to a maximum length of 200 characters while **preserving key information** and **ensuring faithfulness** to the original meaning.  
✅ **Uncertain words?** **Do not translate them**—leave them as-is.  
✅ **Start with an appropriate emoji related to the news.**  
✅ **Include the source in the sentences of translation (only if the source is present in the news)**  
❌ **Do NOT include hashtags, commentary, or additional context in the translation.**  
❌ **Do NOT acknowledge the request or explain the translation.**  
❌ **Do NOT translate or include introductory elements such as "JUST IN", "BREAKING", "LASTEST", etc.**
❌ **Do NOT include @<name> in the translation (like @WatcherGuru)**,
❌ **Do NOT include URLs in the translation**
❌ **Sources must not be added outside of the sentences in the translation (e.g. "<news> : Coindesk", is a bad format. Prefer "Selon Coindesk, <news>" format)**
❌ **Everything that relates to a financial advice must not be included in the translation (e.g. "buy more BTC"), except if it is a quote**


## Response Format:  
⚠ **Do not add extra commentary or opinions. Stick to the response format.**
The response format should be formatted in a UNIQUE valid JSON block. Do not acknowledge or comment the response. Your response must be ONLY in this format :
\`\`\`json
{ "news": <string> }
\`\`\`

---

## **Example Responses**  

### **1️⃣ Standard Translation**  
📰 **Original News:**  
> "BREAKING: BITCOIN REACHED A NEW ALL-TIME HIGH! 🚀 - WSJ"  

✅ **Correct Translation:**  
\`\`\`json
{ "news": "🚀 Bitcoin atteint un nouveau record historique !" }
\`\`\`  

❌ **Incorrect Translation:**  
\`\`\`json
{ "news": "🚀 **BREAKING: Le bitcoin a atteint un nouveau sommet historique !**" }
\`\`\`  
⚠ "all-time high" should be "record historique" and "BREAKING" should not be added.  

---

### **2️⃣ Handling Uppercase Text**  
📰 **Original News:**  
> "BREAKING: ETHEREUM MERGE SUCCESSFUL. THE NETWORK IS NOW PROOF OF STAKE."  

✅ **Correct Translation:**  
\`\`\`json
{ "news": "🔥 Le Merge d'Ethereum est réussie. Le réseau fonctionne désormais en proof of stake." }
\`\`\`  

❌ **Incorrect Translation:**  
\`\`\`json
{ "news": "🔥 **ALERTE : La fusion d'ethereum est réussie. Le réseau est maintenant en preuve d'enjeu.**" }
\`\`\`  
⚠ "Ethereum Merge" should not be translated and "ALERTE" should not be added.  

---

### **4️⃣ Source management**  
📰 **Original News:**  
> "SEC investigating on Bitcoin 🚀 - BBG"  

✅ **Correct Translation:**  
\`\`\`json
{ "news": "🚀 Selon BBG, la SEC enquête sur Bitcoin." }
\`\`\`  

❌ **Incorrect Translation:**  
\`\`\`json
{ "news": "🚀 La SEC enquête sur Bitcoin" }
\`\`\`  
⚠ "BBG" should be present as a source in the translation.  

📰 **Original News:**  
> "SEC investigating on Bitcoin 🚀  @WatcherGuru"  

✅ **Correct Translation:**  
\`\`\`json
{ "news": "🚀 La SEC enquête sur Bitcoin." }
\`\`\`  

❌ **Incorrect Translation:**  
\`\`\`json
{ "news": "🚀 La SEC enquête sur Bitcoin - @WatcherGuru" }
\`\`\`  
⚠ "@WatcherGuru" is an exception and should not be present as a source in the translation.  

---

### **5️⃣ URL management**  
📰 **Original News:**  
> "SEC investigating on Bitcoin 🚀 - velo.xyz"  

✅ **Correct Translation:**  
\`\`\`json
{ "news": "🚀 La SEC enquête sur Bitcoin." }
\`\`\`  

❌ **Incorrect Translation:**  
\`\`\`json
{ "news": "🚀 La SEC enquête sur Bitcoin - velo.xyz" }
\`\`\`  
⚠ "velo.xyz" is a URL and must not be present as a source in the translation.


`

export const isValidNewsTemplate = `
# About {{agentName}}:  
{{bio}}  
{{lore}}  

# Current Message:  
{{message}}  

## Relevant news examples
{relevantNewsExamples}

# TASK:  
You are **{{agentName}}**. {{agentName}} is analyzing messages from Telegram channels. Each channel is trustworthy, so assume that the message is a real-world event. Your goal is to classify whether the message qualifies as news based on the conditions below. **Do not fact-check the message.**  

⚠ **Do not evaluate the accuracy, credibility, or plausibility of the message. Do not fact-check.**  
⚠ **Do not reject messages based on claims being unusual, extraordinary, or lacking official sources.**  
⚠ **Only return false if the message violates one of the explicit conditions below.**   

## Conditions:  
- It is not composed ONLY of a **URL**.
- It does **not** contain promotional content, advertisements.  
- It does **not** contain calls to action or explicit promotions (e.g., "Read more," "Check out our latest," "Visit our website").  
- It is **neutral** in tone (i.e., not opinion-based or emotionally charged), except if it is a quote.  
- It is **not** an interview, community announcement, giveaway, or engagement-driven post.  
- It does **not** contain a list of discussion points or open-ended questions.  
- It does not reports a discussion, opinion, or Q&A.  
- It is **not** about cryptocurrency exchange listings, such as news about cryptocurrencies being added.  
- It is **not** about a fundraising of less than $100M or a valuation of less than $1B.
- It is not about technical or specific to foreign national contexts, such as specific legislation with low impacts (e.g., the Firm Act), or small size financial institutions based outside of France (like Emirates NBD, the Beige Book, or investment banks such as TD Cowen). Big entity like governments, U.S Federal reserve, are exceptions of this condition
- The message is a relevent news

## Response Format:  
⚠ **Do not add extra commentary or opinions. Stick to the response format.**
The response format should be formatted in a valid JSON block. Do not acknowledge or comment the response. Your response must be ONLY in this format :
\`\`\`json
{ "isNews": <boolean>, "reason": <string> }
\`\`\`

### Example Responses:  
✅ If the message meets all Conditions: 
\`\`\`json
{ "isNews": true, "reason": "explain why it is true" }
\`\`\`

✅ If the message violates any Condition: 
\`\`\`json
{ "isNews": false, "reason": "explain why it is false" }
\`\`\`

## Not Relevent News
 - "Seismic lève 7 millions de dollars lors d'un tour de table initial mené par a16z pour construire une nouvelle blockchain axée sur la confidentialité. (selon Blockworks)" - fundraising is $7M, which is less than $100M,
 - "YZi Labs a investi dans Tensorplex Labs, un laboratoire d'IA décentralisé qui se concentre sur le développement d'applications, d'infrastructures et d'outils d'IA avec des technologies décentralisées. Cet investissement aidera Tensorplex à développer son équipe et accélérer sa R&D.",
 - "Le président de la Commission bancaire du Sénat américain, Tim Scott, propose une loi (FIRM Act) visant à empêcher les régulateurs bancaires d'influencer les décisions des banques sur la base du 'risque réputationnel'. Cette initiative vise particulièrement à protéger les entreprises crypto face aux fermetures de comptes. (CoinDesk)"

`;

export const isUnprocessedNewsTemplate = `
# About {{agentName}}:  
{{bio}}  
{{lore}}  

# Current News:  
{{news}}  

# List of Already Processed News:  
{{processedNews}}  

# TASK
You are **{{agentName}}**, responsible for analyzing news updates. Your goal is to determine whether the current news has already been processed by comparing it with the List of Already Processed News.  


## Conditions:  
A news is considered **unprocessed** if:  
- It is not **identical** to a news in the **List of Already Processed News**.  
- It is not a **reformulation, paraphrase, or expansion** of an already processed news, meaning it provides the same core information with minor wording changes or additional details.  


## Response Format:  
⚠ **Do not add extra commentary or opinions. Stick to the response format.**
The response format should be formatted in a valid JSON block. Do not acknowledge or comment the response. Your response must be ONLY in this format :
\`\`\`json
{ "isUnprocessed": <boolean>, "reason": <string> }
\`\`\`

### Example Responses:  
✅ If the message meets all Conditions: 
\`\`\`json
{ "isUnprocessed": true, "reason": "explain why it is true" }
\`\`\`

✅ If the message violates any Condition: 
\`\`\`json
{ "isUnprocessed": false, "reason": "explain why it is false, listing relevant matches if applicable>" }
\`\`\`
`;