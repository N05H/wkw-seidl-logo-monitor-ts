
import dotenv from 'dotenv';    
import cron from "node-cron";
import logger from "./modules/logger";
import TelegramClient from './modules/telegramclient'
import path from 'path';
import LogoClient from './modules/logoclient';
import { MachineStateHandler, MachineState, MachineStateText } from './modules/machinestate';
import { Context } from 'telegraf';
import { Gpio } from './modules/gpio';

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
}, parseInt(process.env.PUPTIMEOUT || "30000"))

const machineStateHandler = new MachineStateHandler(parseInt(process.env.MINOKTIME || "1"))


//------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------
//GPIO
const errorRelayInput = new Gpio(4, 'in', 'both');

errorRelayInput.watch((err: any, value: number) => {
  if (err) {
    console.error('GPIO error:', err);
    return;
  }

  if (value === 0) {
    //NOK state
        machineStateHandler.updateState({
            state: MachineStateText.NOK,
            lastOk: new Date(),
            lastNOK: new Date()
        })
  } else {
    //OK state
        machineStateHandler.updateState({
            state: MachineStateText.OK,
            lastOk: new Date(),
            lastNOK: new Date()
        })
  }
});


//------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------
//General functions

function broadcast(msh: MachineStateHandler){
    telegramClient.sendMessage(msh.state.state.toString())
}



//------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------
//Events
machineStateHandler.on("machineStateOK", (msh: MachineStateHandler) => broadcast(msh))
machineStateHandler.on("machineStateNOK", (msh: MachineStateHandler) => broadcast(msh))
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
            await logoClient.page?.goto("http://localhost:3636/BM/LOGO!%20BM.html", { waitUntil: 'load' })
        }

        await logoClient.gotoBM();
        const [currentState, currentPerformance] = await logoClient.parsePageForConditions()
        logger.info("state result from page:")
        logger.info(JSON.stringify(currentState))
        //removed updating state from parsing site due to timeouts - moving over to IO handling
        //machineStateHandler.updateState(currentState)

        logger.info("performance result from page:")
        logger.info(JSON.stringify(currentPerformance))
        machineStateHandler.updatePerformance(currentPerformance)

        logger.info("Puppeteer process completed");

    } catch (error: any) {
        // Handle any errors during the process
        logger.error("Puppeteer process failed - Anlage kann nicht ausgewertet werden");
        logger.error(error.message);
        // machineStateHandler.update({
        //     machineOk: false,
        //     state: stateText.NOK,
        //     lastOk: new Date(),
        //     lastNOK: new Date(),
        //     power: 0
        // })

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



process.on('SIGINT', () => {
  errorRelayInput.unexport();
  process.exit(0)
});