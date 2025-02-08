
import dotenv from 'dotenv';    
import cron from "node-cron";
import logger from "./modules/logger";
import TelegramClient from './modules/telegramclient'
import path from 'path';
import LogoClient from './modules/logoclient';
import { MachineStateHandler, MachineState, stateText } from './modules/machinestate';
import { Context } from 'telegraf';
import { log } from 'console';


//------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------
//Init

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

const machineStateHandler = new MachineStateHandler(parseInt(process.env.MINOKTIME || "1"))




//------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------
//General functions

function broadcast(){
    telegramClient.sendMessage(machineStateHandler.toString())
}



//------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------
//Events
machineStateHandler.on("machineStateOK", (state: MachineState) => broadcast())
machineStateHandler.on("machineStateNOK", (state: MachineState) => broadcast())
telegramClient.on("status", (ctx: Context) => ctx.reply(machineStateHandler.toString()))


//------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------


async function runProcess() {
    logger.debug("Starting Puppeteer process");

    try {
        // Open the page and perform login (either in dev mode or normal mode)
        await logoClient.openPage();

        if (process.env.MODE == "production") {
            await logoClient.login();
        } else {
            await logoClient.page?.goto("http://localhost:3636/BM/LOGO!%20BM.html", { waitUntil: 'load' });
        }

        await logoClient.gotoBM();
        const result: MachineState = await logoClient.parsePageForConditions();
        logger.info("result from page:");
        logger.info(JSON.stringify(result));
        machineStateHandler.update(result)
        logger.info("Puppeteer process completed");

    } catch (error: any) {
        // Handle any errors during the process
        logger.error("Puppeteer process failed - Anlage kann nicht ausgewertet werden");
        logger.error(error.message);
        machineStateHandler.update({
            machineOk: false,
            state: stateText.NOK,
            lastOk: new Date(),
            lastNOK: new Date(),
            power: 0
        })

    } finally {
        // Ensure the browser is closed at the end of the process
        await logoClient.close();
        logger.info("Puppeteer browser closed");
    }
}





//------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------
//Schedule



// Create the cron expression dynamically
const cronExpression = `*/${process.env.POLLTIME || 3 } * * * *`;

runProcess()
.finally(() => {
    logger.info("Started scheduler")
    const job = cron.schedule(cronExpression, () => {
        runProcess()
    });
})


