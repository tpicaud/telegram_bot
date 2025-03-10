import {
    IAgentRuntime,
    UUID,
    Content,
    Memory,
    HandlerCallback,
    ModelClass,
    State,
    Media,
    elizaLogger,
    getEmbeddingZeroVector,
    composeContext,
    generateMessageResponse,
    stringToUuid,
    generateText,
} from "@elizaos/core";
import { TelegramAccountConfig } from "./environment.ts";
import { TelegramClient, Api } from "telegram";
import { StoreSession } from "telegram/sessions";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { Entity } from "telegram/define";
import input from "input";
import bigInt from "big-integer";
import { getTelegramAccountMessageHandlerTemplate, translateNewsTemplate, isValidNewsTemplate, isUnprocessedNewsTemplate } from "./templates.ts"
import { escapeMarkdown, splitMessage } from "./utils.ts";
import { Dialog } from "telegram/tl/custom/dialog";
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export class TelegramAccountClient {
    private runtime: IAgentRuntime;
    private telegramAccountConfig: TelegramAccountConfig;
    private client: TelegramClient;
    private account: Api.User;

    constructor(runtime: IAgentRuntime, telegramAccountConfig: TelegramAccountConfig) {
        elizaLogger.log("📱 Constructing new TelegramAccountClient...");

        this.runtime = runtime;
        this.telegramAccountConfig = telegramAccountConfig;

        elizaLogger.log("✅ TelegramClient constructor completed");
    }

    public async start(): Promise<void> {
        elizaLogger.log("🚀 Starting Telegram account...");

        try {
            await this.initializeAccount();

            // News handling
            this.listenToNews()

            // Enable response to users
            // this.setupEventsHandlers();

            elizaLogger.success(`✅ Telegram account client successfully started for character ${this.runtime.character.name}`);
        } catch (error) {
            elizaLogger.error("❌ Failed to launch Telegram account:", error);
            throw error;
        }
    }

    private async initializeAccount(): Promise<void> {
        // Prepare telegram account client
        this.client = new TelegramClient(
            new StoreSession('./data/telegram_account_session'),
            this.telegramAccountConfig.TELEGRAM_ACCOUNT_APP_ID,
            this.telegramAccountConfig.TELEGRAM_ACCOUNT_APP_HASH,
            {
                connectionRetries: 5,
                deviceModel: this.telegramAccountConfig.TELEGRAM_ACCOUNT_DEVICE_MODEL,
                systemVersion: this.telegramAccountConfig.TELEGRAM_ACCOUNT_SYSTEM_VERSION,
            }
        )

        // Account sign in or connect
        await this.client.start({
            phoneNumber: this.telegramAccountConfig.TELEGRAM_ACCOUNT_PHONE,
            password: null,
            phoneCode: async () => await input.text('Enter received Telegram code: '),
            onError: (err) => console.log(err),
        });

        this.client.session.save();

        // Testing connection
        this.account = await this.client.getEntity('me') as Api.User;
    }

    private setupEventsHandlers(): void {
        this.newMessageHandler();
    }

    private newMessageHandler() {
        this.client.addEventHandler(async (event: NewMessageEvent) => {
            try {
                if (!event.message.message) return;

                // Get sender and chat full object
                const sender = await event.message.getSender();
                if (sender.className != 'User') return;

                const chat = (await event.message.getChat());
                if (chat.className != 'User' && chat.className != 'Chat' && (chat.className == 'Channel' && !chat.megagroup)) return;

                // Get user full name
                let senderName = sender.firstName;
                if (sender.lastName) senderName += ' ' + sender.lastName;

                // Get reply message
                let replyMessage = null;
                if (event.message.replyTo) {
                    replyMessage = await event.message.getReplyMessage()
                }

                // Convert IDs to UUIDs
                const userUUID = stringToUuid(`tg-${sender.id.toString()}`) as UUID;
                const roomUUID = stringToUuid(`tg-${chat.id.toString()}` + "-" + this.runtime.agentId) as UUID;
                const messageUUID = stringToUuid(`tg-message-${roomUUID}-${event.message.id.toString()}` + "-" + this.runtime.agentId) as UUID;
                const agentUUID = this.runtime.agentId;
                const replyMessageUUID = replyMessage ? stringToUuid(`tg-message-${roomUUID}-${replyMessage.id.toString()}` + "-" + this.runtime.agentId) as UUID : null;

                // Ensure connection
                await this.runtime.ensureConnection(
                    userUUID,
                    roomUUID,
                    sender.username,
                    senderName,
                    "telegram-account",
                );

                if (!event.message.message) return;

                // Create content
                const content: Content = {
                    text: event.message.message,
                    inReplyTo: replyMessageUUID,
                    source: "telegram-account",
                };

                // Create memory for the message
                const memory: Memory = {
                    id: messageUUID,
                    agentId: agentUUID,
                    userId: userUUID,
                    roomId: roomUUID,
                    content,
                    createdAt: event.message.date * 1000,
                    embedding: getEmbeddingZeroVector(),
                };

                // Create memory
                await this.runtime.messageManager.createMemory(memory);

                // Update state with the new memory
                let state = await this.runtime.composeState(memory);
                state = await this.runtime.updateRecentMessageState(state);

                // Decide whether to respond
                const shouldRespond = await this._shouldRespond(event.message, chat, replyMessage);

                // Send response in chunks
                const callback: HandlerCallback = async (content: Content) => {
                    const sentMessages = await this.sendMessageInChunks(
                        chat.id,
                        content,
                        chat.className == 'User' ? null : event.message.id
                    );

                    if (sentMessages) {
                        const memories: Memory[] = [];

                        // Create memories for each sent message
                        for (let i = 0; i < sentMessages.length; i++) {
                            const sentMessage = sentMessages[i];
                            const isLastMessage = i === sentMessages.length - 1;

                            const memory: Memory = {
                                id: stringToUuid(`tg-message-${roomUUID}-${sentMessage.id.toString()}` + "-" + this.runtime.agentId) as UUID,
                                agentId: agentUUID,
                                userId: agentUUID,
                                roomId: roomUUID,
                                content: {
                                    ...content,
                                    text: sentMessage.message,
                                    inReplyTo: messageUUID,
                                },
                                createdAt: sentMessage.date * 1000,
                                embedding: getEmbeddingZeroVector(),
                            };

                            // Set action to CONTINUE for all messages except the last one
                            // For the last message, use the original action from the response content
                            memory.content.action = !isLastMessage
                                ? "CONTINUE"
                                : content.action;

                            await this.runtime.messageManager.createMemory(memory);
                            memories.push(memory);
                        }

                        return memories;
                    }
                };

                if (shouldRespond) {
                    // Mark chat as read
                    await this.client.markAsRead(chat);

                    // Show that a bot is typing a message
                    await this.client.invoke(
                        new Api.messages.SetTyping({
                            peer: chat,
                            action: new Api.SendMessageTypingAction()
                        })
                    );

                    // Generate response
                    const template = this.runtime.character?.templates
                        ?.messageHandlerTemplate ||
                        getTelegramAccountMessageHandlerTemplate(this.account);

                    const context = composeContext({
                        state,
                        template: template,
                    });

                    const responseContent = await this._generateResponse(
                        memory,
                        state,
                        context
                    );

                    if (!responseContent || !responseContent.text) return;

                    // Execute callback to send messages and log memories
                    const responseMessages = await callback(responseContent);

                    // Update state after response
                    state = await this.runtime.updateRecentMessageState(state);

                    // Handle any resulting actions
                    await this.runtime.processActions(
                        memory,
                        responseMessages,
                        state,
                        callback
                    );
                }

                await this.runtime.evaluate(memory, state, shouldRespond, callback);
            } catch (error) {
                elizaLogger.error("❌ Error handling message:", error);
                elizaLogger.error("Error sending message:", error);
            }
        }, new NewMessage({ incoming: true }));
    }

    // Decide if the bot should respond to the message
    private async _shouldRespond(
        message: Api.Message,
        chat: Entity,
        replyMessage?: Api.Message
    ): Promise<boolean> {
        if (replyMessage) {
            const replyFrom = replyMessage.fromId as Api.PeerUser;
            if (replyFrom && replyFrom.userId.eq(this.account.id)) return true;
        }

        if (chat.className == 'User') {
            return true;
        }
        else {
            return message.message.includes(`@${this.account.username}`)
        }
    }

    // Generate a response using AI
    private async _generateResponse(
        message: Memory,
        _state: State,
        context: string
    ): Promise<Content> {
        const { userId, roomId } = message;

        const response = await generateMessageResponse({
            runtime: this.runtime,
            context,
            modelClass: ModelClass.LARGE,
        });

        if (!response) {
            console.error("❌ No response from generateMessageResponse");
            return null;
        }

        await this.runtime.databaseAdapter.log({
            body: { message, context, response },
            userId,
            roomId,
            type: "response",
        });

        return response;
    }

    // Send long messages in chunks
    private async sendMessageInChunks(
        chatId: bigInt.BigInteger,
        content: Content,
        replyToMessageId?: number
    ) {
        if (content.attachments && content.attachments.length > 0) {
            content.attachments.map(async (attachment: Media) => {
                await this.client.sendFile(
                    chatId,
                    {
                        file: attachment.url,
                        forceDocument: true,
                        caption: attachment.description,
                        replyTo: replyToMessageId
                    }
                );

            });
        } else {
            const chunks = splitMessage(content.text);
            const sentMessages = [];

            for (let i = 0; i < chunks.length; i++) {
                const chunk = escapeMarkdown(chunks[i]);

                const sentMessage = await this.client.sendMessage(
                    chatId,
                    {
                        message: chunk,
                        parseMode: 'markdown',
                        replyTo: replyToMessageId
                    }
                );

                sentMessages.push(sentMessage);
            }

            return sentMessages;
        }
    }


    //////////////////////
    // Cryptoast Repost //
    //////////////////////

    private async listenToNews() {

        const repost_channel = await this.getCryptoastChannel()
        const listening_channels = await this.getNewsChannels();

        if (repost_channel && listening_channels.length > 0) {
            elizaLogger.info(`📡 Listening to ${listening_channels.length} channels.`);
            elizaLogger.info(`Reposting news on ${repost_channel.name}`)

            // Stockage des derniers messages des channels
            const lastMessageIds = new Map<number, number>();

            // Charger les mots à ne pas traduire
            const notToBeTranslatedWords = await this.loadNotToTranslateWords()

            setInterval(async () => {

                const newMessages: Api.Message[] = await this.getNewMessagesFromChannels(listening_channels, lastMessageIds)

                if (newMessages.length > 0) {
                    elizaLogger.info(`Found ${newMessages.length} candidate news`)
                    for (const message of newMessages) {

                        elizaLogger.info(`Candidate news ${message.id}`, {
                            message: message.message,
                        })

                        const isValidNews = await this.isValidNews(message)

                        if (isValidNews) {
                            try {

                                elizaLogger.info(`✅ Message ${message.id} consider as news`);

                                const channel = message.chat
                                const sender = await message.getSender()

                                // Build UUIDs
                                const userUUID = stringToUuid(`tg-${sender.id.toString()}`) as UUID;
                                const roomUUID = stringToUuid(`tg-${channel.id.toString()}` + "-" + this.runtime.agentId) as UUID;
                                const messageUUID = stringToUuid(`tg-message-${roomUUID}-${message.id.toString()}` + "-" + this.runtime.agentId) as UUID;
                                const agentUUID = this.runtime.agentId;

                                // Ensure connection
                                await this.runtime.ensureConnection(
                                    userUUID,
                                    roomUUID,
                                );

                                // Create content
                                const content: Content = {
                                    text: message.message,
                                };

                                // Create memory for the message
                                const memory: Memory = {
                                    id: messageUUID,
                                    agentId: agentUUID,
                                    userId: userUUID,
                                    roomId: roomUUID,
                                    content,
                                    createdAt: message.date * 1000,
                                    embedding: getEmbeddingZeroVector(),
                                };

                                // Create memory
                                await this.runtime.messageManager.createMemory(memory);

                                // Compose state with the new memory
                                let state = await this.runtime.composeState(
                                    memory,
                                    {
                                        news: message.message,
                                        notToBeTranslatedWords
                                    }
                                );

                                // Generate response
                                const context = composeContext({
                                    state,
                                    template: translateNewsTemplate,
                                });

                                console.log(context);

                                elizaLogger.info(`Generating transation for :\n ${message.id}`)

                                const response = await this.generateResponseFromLLM(context)

                                elizaLogger.info(`Response from LLM: `, {
                                    response
                                })
                                try {
                                    const cleanedResponse = this.cleanJSONResponse(response);
                                    const responseJSON = JSON.parse(cleanedResponse);
                                    const news = responseJSON.news;

                                    // Execute callback to send messages
                                    const sentMessage = await this.client.sendMessage(
                                        repost_channel.id,
                                        {
                                            message: news,
                                            parseMode: 'markdown',
                                            file: this.messageContainsVideo(message) ? message.media : null
                                        }
                                    );
                                    elizaLogger.info(`✅ Message sent to ${repost_channel.name}`)
                                } catch (error) {
                                    elizaLogger.error("Error parsing response from LLM")
                                    return false;
                                }
                            } catch (error) {
                                elizaLogger.error(`❌ Erreur lors de la gestion du message pour :`, error);
                            }
                        } else {
                            elizaLogger.info(`⏭️ Message ${message.id} not a news or already processed, skipping`)
                        }
                    }
                }
            }, 5000);
        } else {
            elizaLogger.error('Cryptoast channel not found')
        }
    }

    private async getCryptoastChannel() {
        const CRYPTOAST_CHANNEL_NAME = 'Cryptoast News';

        const dialogs = await this.client.getDialogs();
        const channels = dialogs.filter(d => d.isChannel);

        // 🔥 Trouver le canal Cryptoast
        const cryptoast_channel = channels.find(
            (channel) => channel.title === CRYPTOAST_CHANNEL_NAME || channel.name === CRYPTOAST_CHANNEL_NAME
        );

        if (!cryptoast_channel) {
            elizaLogger.error(`❌ Le canal "${CRYPTOAST_CHANNEL_NAME}" n'a pas été trouvé.`);
            return null; // ✅ Retourne `null` si le canal n'existe pas
        } else {
            elizaLogger.log(`✅ Canal trouvé : ${cryptoast_channel.title} (ID: ${cryptoast_channel.id})`);
            return cryptoast_channel; // ✅ Retourne le canal trouvé
        }
    }


    private async getNewsChannels(): Promise<Dialog[]> {
        const CHANNEL_NAMES = ['News Channel', 'Phoenix News (Only Important)', 'Wu Blockchain News', 'Tree News', 'Watcher Guru'];

        const dialogs = await this.client.getDialogs();
        const channels = dialogs.filter(d => d.isChannel);

        // Filter channels
        const newsChannels = channels.filter(
            (channel) => CHANNEL_NAMES.includes(channel.title) || CHANNEL_NAMES.includes(channel.name)
        );

        if (newsChannels.length === 0) {
            console.error(`❌ Aucun des canaux "${CHANNEL_NAMES.join(', ')}" n'a été trouvé.`);
            return []; // ✅ Retourne une liste vide si aucun canal n'est trouvé
        } else {
            console.log(`✅ Canaux trouvés : ${newsChannels.map(c => c.title).join(', ')}`);
            return newsChannels; // ✅ Retourne la liste des canaux trouvés
        }
    }

    private async getNewMessagesFromChannels(channels: Dialog[], lastMessageIds): Promise<Api.Message[]> {
        const newMessages: Api.Message[] = [];

        for (const channel of channels) {
            try {
                const messages = await this.client.getMessages(channel.id, { limit: 1 }); // Récupère le dernier message

                if (messages.length > 0) {
                    const message = messages[0];

                    // Vérifier si le message a déjà été traité
                    const lastMessageId = lastMessageIds.get(channel.id) || 0;

                    // TODO fix when receiving message with multiple photos

                    if (message.id > lastMessageId) {
                        if (message.message && message.message.trim().length > 0) { // Si c'est un nouveau message
                            lastMessageIds.set(channel.id, message.id); // Met à jour l'ID du dernier message
                            newMessages.push(message); // Ajoute le message à la liste des nouveaux
                        }
                    }
                }
            } catch (error) {
                console.error(`❌ Erreur lors de la récupération du message pour ${channel.title}:`, error);
            }
        }

        return newMessages;
    }

    private async isValidNews(message: Api.Message): Promise<boolean> {


        const formatedNews = this.cleanText(message.message)

        // Create content
        const content: Content = {
            text: formatedNews,
        };

        // Build UUID
        const userUUID = stringToUuid(`tg-${this.account.id.toString()}`) as UUID;
        const roomUUID = stringToUuid(`tg-processedNews` + "-" + this.runtime.agentId) as UUID;
        const messageUUID = stringToUuid(`tg-message-${roomUUID}-${message.id.toString()}` + "-" + this.runtime.agentId) as UUID;
        const agentUUID = this.runtime.agentId;

        // Create memory for the message
        const memory: Memory = {
            id: messageUUID,
            agentId: agentUUID,
            userId: userUUID,
            roomId: roomUUID,
            content,
            createdAt: message.date * 1000,
            embedding: getEmbeddingZeroVector(),
        };


        // Check if the news is a real news
        elizaLogger.info(`Asking LLM to check if message ${message.id} is a news`);
        const isNews = await this.isNews(memory);

        if (isNews) {

            // Check if the news is not already processed
            elizaLogger.info(`Asking LLM to check if message ${message.id} is unprocessed`);
            const isUnprocessed: boolean = await this.isUnprocessed(memory);
            console.log(isUnprocessed)
            if (isUnprocessed) {
                console.log('in isUnprocessed, value: ', isUnprocessed)
                // The news is valid
                elizaLogger.log(`News ${message.id} is considerd as valid news`);
                await this.runtime.messageManager.createMemory(memory);
                return true;
            }
        }

        return false;
    }

    private async isNews(memory: Memory): Promise<boolean> {
        // Compose state with the new memory
        let state = await this.runtime.composeState(
            memory,
            {
                message: memory.content.text,
            }
        );

        // ask llm if news is already processed or not
        const context = composeContext({
            state,
            template: isValidNewsTemplate,
        });

        console.log(context);

        const response = await this.generateResponseFromLLM(context);

        if (!response) {
            return false
        }

        elizaLogger.info(`Response from LLM: `, {
            response
        })

        try {
            const cleanedResponse = this.cleanJSONResponse(response);
            const responseJSON = JSON.parse(cleanedResponse)
            return responseJSON.isNews;
        } catch (error) {
            elizaLogger.error("Error parsing response from LLM")
            return false;
        }
    }

    private async isUnprocessed(memory: Memory): Promise<boolean> {
        const cryptoast_channel = await this.getCryptoastChannel()

        // retrieve processedNews
        elizaLogger.log(`Fetching last processed news from ${cryptoast_channel.name}`)
        const processedNews = await this.getLastProcessedNewsFromChannel(cryptoast_channel)
        elizaLogger.log(`Found ${processedNews.length} processed news last 24h`)

        // Format news
        const formattedProcessedNews = processedNews.map((news, index) => `${index}: ${this.cleanText(news)}\n`);

        // Compose state with the new memory
        let state = await this.runtime.composeState(
            memory,
            {
                news: memory.content.text,
                processedNews: formattedProcessedNews
            }
        );

        // ask llm if news is already processed or not
        const context = composeContext({
            state,
            template: isUnprocessedNewsTemplate,
        });

        console.log(context);

        const response = await this.generateResponseFromLLM(context);

        if (!response) {
            return false;
        }

        elizaLogger.info(`Response from LLM: `, {
            response
        })

        try {
            const cleanedResponse = this.cleanJSONResponse(response);
            const responseJSON = JSON.parse(cleanedResponse)
            elizaLogger.info({
                responseJSON
            })
            return responseJSON.isUnprocessed;
        } catch (error) {
            elizaLogger.error("Error parsing response from LLM");
            return false;
        }
    }

    private async generateResponseFromLLM(context: string, maxRetries: number = 4): Promise<string> {
        const baseDelay = 1000; // Délai initial en millisecondes (1 seconde)

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await generateText({
                    runtime: this.runtime,
                    context,
                    modelClass: ModelClass.LARGE
                });
                return response;
            } catch (error) {
                if (attempt === maxRetries) {
                    elizaLogger.error("Max retries reached. Error generating response from LLM: ", error);
                } else {
                    // Exponential backoff
                    const delay = baseDelay * Math.pow(2, attempt - 1); // Délai double à chaque échec
                    elizaLogger.warn(`Error generating response. Retrying in ${delay / 1000} seconds...`);

                    // Attendre le délai avant la prochaine tentative
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
    }


    private async getLastProcessedNewsFromChannel(channel: Dialog): Promise<string[]> {
        const messages: string[] = [];
        const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);

        try {
            const fetchedMessages = await this.client.getMessages(channel.id, { limit: 100 });

            for (const message of fetchedMessages) {
                if (message.message && message.date && message.date >= twentyFourHoursAgo) {
                    messages.push(this.cleanText(message.message));
                }
            }
        } catch (error) {
            console.error(`❌ Error while retrieving last processed news ${channel.title}:`, error);
        }

        return messages;
    }

    private async loadNotToTranslateWords(): Promise<string[]> {
        try {
            const filePath = path.resolve(__dirname, '../data/notToBeTranslatedWords.json');
            const data = await fs.readFile(filePath, 'utf-8');
            const jsonData = JSON.parse(data);
            if (jsonData.notToBeTranslatedWords && Array.isArray(jsonData.notToBeTranslatedWords)) {
                elizaLogger.info(`📌 Loaded ${jsonData.notToBeTranslatedWords.length} words to not translate.`);
                return jsonData.notToBeTranslatedWords;
            } else {
                elizaLogger.warn("⚠️ Invalid format for 'notToBeTranslatedWords.json'. Expected an array.");
                return [];
            }
        } catch (error) {
            elizaLogger.error("❌ Error loading 'notToBeTranslatedWords.json':", error);
            return [];
        }
    }


    private messageContainsVideo(message: Api.Message): boolean {
        elizaLogger.info({
            message: message
        })
        if (message.media instanceof Api.MessageMediaDocument) {
            const document = message.media.document;

            // Vérifier si le document est défini
            if (document instanceof Api.Document) {
                // Vérifier le type MIME ou les attributs du document
                return document.mimeType?.startsWith("video/") ||
                    document.attributes.some(attr => attr instanceof Api.DocumentAttributeVideo);
            }
        }

        return false;
    }


    private cleanText(text: string): string {
        return text.trim().replace(/\s+/g, ' ');
    }

    private cleanJSONResponse(response: string): string {
        return response.replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim();
    }
}