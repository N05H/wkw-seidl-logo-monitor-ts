
import dotenv from 'dotenv';    
import cron from "node-cron";
import logger from "./modules/logger";
import TelegramClient from './modules/telegramclient'
import path from 'path';


// Load environment variables from .env file
dotenv.config();
const token = process.env.TELEGRAM_TOKEN || "";
const chatIdFile = path.join(__dirname, 'data/chatIds.json');
const telegramClient = new TelegramClient(token, chatIdFile);


logger.info("Application started")

setInterval(() => console.log("Alive"), 3000)