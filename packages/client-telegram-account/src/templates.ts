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
{{telegramAccountInfo}}
{{bio}}
{{lore}}

# Words not to be translated
{{notToBeTranslatedWords}}

# News
{{news}}

# TASK:  
Translate the **news** into **French**, maintaining the voice, tone, and perspective of {{agentName}}.  

### **Translation Rules:**  
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
✅ **Include the source in the translation if it is present in the news**  
❌ **Do not include hashtags, @, commentary, or additional context.**  
❌ **Do not acknowledge the request or explain the translation.**  
❌ **Do not translate or include introductory elements such as "JUST IN", "BREAKING", "LASTEST", etc.**
❌ **Do NOT include URLs in the translation**
❌ **If the news cannot be translated, reply with "IGNORE"—no extra words.**  

---

### **Example Responses:**  

#### **1️⃣ Standard Translation**  
📰 **Original News:**  
> "BREAKING: BITCOIN REACHED A NEW ALL-TIME HIGH! 🚀 - WSJ"

✅ **Correct Translation:**  
> 🚀 Bitcoin atteint un nouveau record historique !.  

❌ **Incorrect Translation:**  
> 🚀 **BREAKING: Le bitcoin a atteint un nouveau sommet historique !** (⚠ "all-time high" should be "record historique" and "BREAKING" should not be added)

---

#### **2️⃣ Handling Uppercase Text**  
📰 **Original News:**  
> "BREAKING: ETHEREUM MERGE SUCCESSFUL. THE NETWORK IS NOW PROOF OF STAKE."  

✅ **Correct Translation:**  
> 🔥 **Le Merge d'Ethereum est réussie. Le réseau fonctionne désormais en proof of stake.**  

❌ **Incorrect Translation:**  
> 🔥 **ALERTE : La fusion d'ethereum est réussie. Le réseau est maintenant en preuve d'enjeu.** (⚠ "Ethereum Merge" should not be translated and "ALERTE" should not be added)  

---

#### **3️⃣ Summarization (if too long)**  
📰 **Original News:**  
> "The SEC has announced a new investigation into crypto exchanges. Regulators suspect manipulation in BTC trading, which could lead to stricter regulations."  

✅ **Correct Summarization:**  
> ⚖️ **The SEC investigates crypto exchanges over suspected BTC manipulation. Stricter regulations may follow.**  

❌ **Incorrect Translation:**  
> ⚖️ **The SEC is launching an investigation into cryptocurrency platforms due to suspected manipulation in the Bitcoin market, which could result in new regulations.** (⚠ Too long, not synthesized)  

---

#### **4️⃣ Source management**  
📰 **Original News:**  
> "SEC investigating on Bitcoin 🚀 - BBG"

✅ **Correct Translation:**  
> 🚀 Selon BBG, la SEC enquête sur Bitcoin.  

❌ **Incorrect Translation:**  
> 🚀 **La SEC enquête sur Bitcoin** (⚠ "BBG" should be present as a source in the translation)

📰 **Original News:**  
> "SEC investigating on Bitcoin 🚀  @WatcherGuru"

✅ **Correct Translation:**  
> 🚀 La SEC enquête sur Bitcoin.  

❌ **Incorrect Translation:**  
> 🚀 **La SEC enquête sur Bitcoin** (⚠ "@WatcherGuru" is an exception and should not be present as a source in the translation)

---

#### **4️⃣ URL management**  
📰 **Original News:**  
> "SEC investigating on Bitcoin 🚀 - velo.xyz"

✅ **Correct Translation:**  
> 🚀 La SEC enquête sur Bitcoin.  

❌ **Incorrect Translation:**  
> 🚀 **La SEC enquête sur Bitcoin** - velo.xyz (⚠ "velo.xyz" is a URL and must not be present as a source in the translation)

---

#### **5️⃣ "IGNORE" Case**  
📰 **Original News:**  
> "https://example.com/latest-news-about-crypto"  

✅ **Response:**  
> **IGNORE**  
`

export const isValidNewsTemplate = `
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
- It is not composed only of a **URL**.
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

export const isUnprocessedNewsTemplate = `
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