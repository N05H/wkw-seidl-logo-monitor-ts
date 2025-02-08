
import { Context, Telegraf } from 'telegraf';
import { EventEmitter } from 'events';
import fs from 'fs';
import logger from "./logger";


class TelegramClient extends EventEmitter {
    private token: string;
    private chatIdFile: string;
    private chatIds: number[];
    private bot: Telegraf;
    private registeredCommands: string[] = []; // Store registered commands

    constructor(token: string, chatIdFile: string) {
        super();
        this.token = token;
        this.chatIdFile = chatIdFile;
        this.chatIds = this.readChatIds(this.chatIdFile);
        this.bot = new Telegraf(this.token);
        this.initializeHandles();

        this.bot.launch();

        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    }



    private initializeHandles(): void {
        // Middleware to handle new chat IDs
        this.bot.use((ctx, next) => {
            const chatId = ctx.chat?.id;
            if (chatId === undefined) {
                logger.warn('Received a message without a chat ID');
                return next(); // Optionally, you can stop further processing here or return an error
            }

            if (!this.chatIds.includes(chatId)) {
                this.chatIds.push(chatId);
                this.writeChatIds(this.chatIdFile, this.chatIds);
            }
            return next();
        });



        // Simple start message
        this.bot.start((ctx) => ctx.reply('Welcome to WKW Bot!'));


        this.registerCommand('status', (ctx: Context) => {
            this.emit('status', ctx); // Emit the 'status' event when /status is called
        });

        this.registerCommand('help', (ctx: Context) => {
            ctx.reply(this.registeredCommands.join('\n'))
        });

        // Fallback message for all other cases
        this.bot.hears(/.*/, (ctx) => ctx.reply('Hello, send a message!'));
    }

    private registerCommand(command: string, handler: (ctx: any) => void) {
        this.registeredCommands.push(command); // Store the command
        this.bot.command(command, handler); // Register the command
    }


    private readChatIds(path: string): number[] {
        if (fs.existsSync(path)) {
            const data = fs.readFileSync(path, 'utf-8');
            try {
                return JSON.parse(data);
            } catch (error) {
                logger.error(`Error reading chat IDs: ${error}`);
                return [];
            }
        }
        return [];
    }


    private writeChatIds(path: string, chatIds: number[]): void {
        try {
            fs.writeFileSync(path, JSON.stringify(chatIds, null, 2), 'utf-8');
        } catch (error) {
            logger.error(`Error writing chat IDs: ${error}`);
        }
    }


    public sendMessage(msg: string): void {
        this.chatIds.forEach((id) => {
            this.bot.telegram
                .sendMessage(id, msg)
                .then(() => {
                    logger.info(`Sent message to chat ID: ${id}`);
                })
                .catch((error) => {
                    logger.error(`Failed to send message to chat ID: ${id}. Error: ${error}`);
                });
        });
    }

    public getRegisteredCommands(): string[] {
        return this.registeredCommands;
    }

}



export default TelegramClient;