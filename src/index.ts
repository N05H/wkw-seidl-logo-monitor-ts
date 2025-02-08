
import dotenv from 'dotenv';    
import cron from "node-cron";
import logger from "./modules/logger";
import TelegramClient from './modules/telegramclient'
import path from 'path';
import { Context } from 'telegraf';
import LogoClient from './modules/logoclient';
import { MachineState } from './modules/machinestate';

// Load environment variables from .env file
dotenv.config();

logger.level = process.env.LOGLEVEL || "info";
const chatIdFile = path.join(__dirname, 'data/chatIds.json');
const telegramClient = new TelegramClient(process.env.TELEGRAM_TOKEN || "", chatIdFile);
const logoClient = new LogoClient({
    headless: true,
    password: process.env.LOGO_PASSWORD || "",
    urlLogin:process.env.LOGO_URL || ""
})




async function runProcess() {
    logger.debug("Starting Puppeteer process");

    try {
        // Open the page and perform login (either in dev mode or normal mode)
        await logoClient.openPage();

        if (process.env.MODE == "PRODUCTION") {
            await logoClient.login();
        } else {
            await logoClient.page?.goto("http://localhost:3636/BM/LOGO!%20BM.html", { waitUntil: 'load' });
        }

        await logoClient.gotoBM();
        const result: MachineState = await logoClient.parsePageForConditions();
        logger.info("result from page:");
        logger.info(JSON.stringify(result));
        //machineState.updateState(result);
        //telegramClient.sendMessage(JSON.stringify(result))
        logger.info("Puppeteer process completed");

    } catch (error: any) {
        // Handle any errors during the process
        logger.error("Puppeteer process failed - Anlage kann nicht ausgewertet werden");
        logger.error(error.message);

        // Fallback to a default result in case of failure
        //machineState.updateState(logoClient.getResultObject(new Date(), "Anlage kann nicht ausgewertet werden", 0.0));
    } finally {
        // Ensure the browser is closed at the end of the process
        await logoClient.close();
        logger.info("Puppeteer browser closed");
    }
}








runProcess()

setInterval(() => {
    runProcess()
}, 120_000)