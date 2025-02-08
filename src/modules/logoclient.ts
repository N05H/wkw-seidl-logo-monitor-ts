
import puppeteer, { Page, Browser, ElementHandle, LaunchOptions } from 'puppeteer';
import os from 'os';
import logger from "./logger";
import { MachineState, stateText } from './machinestate';
import { stat } from 'fs';


export interface LogoClientConfig {
    urlLogin: string,
    password: string,
    headless: boolean
}


class LogoClient {
    private config: LogoClientConfig;
    private browser: Browser | null;
    page: Page | null;


    constructor(config: LogoClientConfig) {
        this.config = config
        this.browser = null;
        this.page = null;
    }



    async openPage(): Promise<LogoClient> {
        try {
            const launchOptions: LaunchOptions = {
                headless: this.config.headless,
                args: [
                    '--start-fullscreen',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-site-isolation-trials'
                ]
            };

            if (os.platform() === 'linux') {
                launchOptions.executablePath = '/usr/bin/chromium-browser';
            }

            const browser = await puppeteer.launch(launchOptions);
            this.browser = browser;
            this.page = await browser.newPage();

            const { width, height } = await this.page.evaluate(() => ({
                width: window.screen.availWidth,
                height: window.screen.availHeight
            }));

            await this.page.setViewport({ width, height });
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');

            return this;
        } catch (error: any) {
            logger.error('Error initializing Puppeteer: ' + error.message);
            if (this.browser) await this.close();
            throw error;
        }
    }





    // Login
    async login(): Promise<void> {
        logger.info("Puppeteer Login");
        try {
            await this.page?.goto(this.config.urlLogin, { waitUntil: 'load' });
            await this.page?.waitForNavigation();
            await this.page?.waitForSelector('#input_password');
            await this.page?.type('#input_password', this.config.password);
            await this.page?.click('#button_login');
            await this.page?.waitForNavigation();
        } catch (error: any) {
            logger.error('Login failed: ' + error.message);
            throw error;
        }
    }


    // Navigate to BM page
    async gotoBM(): Promise<void> {
        logger.info("Puppeteer gotoBM");
        try {
            const navBtn = await this.getNavBtnToBM();
            if (navBtn) {
                await navBtn.evaluate((el: Element) => {
                    // You can safely cast `el` to HTMLElement inside the evaluate function
                    (el as HTMLElement).click();
                });
                await this.page?.waitForNavigation();
                await Promise.all([
                    this.page?.waitForSelector('.msg_bar_bg'),
                    this.page?.waitForSelector('.msg_bar_fill')
                ]);
            }
        } catch (error: any) {
            logger.error('Failed to navigate to BM: ' + error.message);
            throw error;
        }
    }


    // Get navigation button to BM
    private async getNavBtnToBM(): Promise<ElementHandle | null> {
        logger.info("Puppeteer getNavBtnToBM");
        const navbarid = "desktopMenue";
        const elementHandle = await this.page?.$(`#${navbarid}`);

        if (!elementHandle) {
            logger.error("Element not found: " + navbarid);
            return null;
        }

        const ulHandle = await elementHandle.$('ul');
        if (!ulHandle) {
            logger.error("ul not found in " + navbarid);
            return null;
        }

        const liHandles = await ulHandle.$$('li');
        for (let liHandle of liHandles) {
            const aHandle = await liHandle.$('a');
            if (aHandle) {
                const targetPage = await this.page?.evaluate(el => el.getAttribute('target_page'), aHandle);
                if (targetPage === "/logo_bm_01.shtm") {
                    return aHandle;
                }
            }
        }

        return null;
    }



    // Parse page for conditions
    async parsePageForConditions(): Promise<MachineState> {
        logger.info("Puppeteer parsePageForConditions");
        try {
            const currentMachineState: MachineState = {
                machineOk: false,
                state: await this.getStatus(),
                lastOk: new Date(),
                lastNOK: new Date(),
                power: await this.getPower()
            }

            currentMachineState.machineOk = currentMachineState.power > 0.1;
            return currentMachineState;
        } catch (error: any) {
            logger.error('Failed to parse page for conditions: ' + error.message);
            throw error;
        }
    }



    // Get Status
    private async getStatus(): Promise<stateText> {
        logger.info("Puppeteer getStatus");
        const wordsToCheck = ["Status", "Ein", "Anlage", "ist", "am", "Netz!"];
        
        try {
            await this.page?.waitForSelector('#show_screen');
            
            const status = await this.page?.evaluate((words, stateText) => {
                const div = document.querySelector('#show_screen');
                const htmlContent = div?.innerHTML || '';
                return words.every(word => htmlContent.includes(word)) ? stateText.OK : stateText.NOK
            }, wordsToCheck, stateText);

            return status || stateText.UNKNOWN;
        } catch (err: any) {
            logger.error('Error getting status: ' + err.message);
            return stateText.NOK
        }
    }



    // Get Power
    private async getPower(): Promise<number> {
        logger.info("Puppeteer getPower");
        try {
            await this.page?.waitForSelector('.msg_bar_fill');
            const msgBarFillHandle = await this.page?.$('.msg_bar_fill');
            if (!msgBarFillHandle) return -1.0;

            const width = await this.page?.evaluate(el => {
                return window.getComputedStyle(el).width;
            }, msgBarFillHandle);

            return width ? this.parsePixelToPower(width) : -1.0;
        } catch (err: any) {
            logger.error('Error getting power: ' + err.message);
            return -1.0;
        }
    }




    // Close browser
    async close(): Promise<void> {
        logger.info("Puppeteer close");
        if (this.browser) {
            try {
                await this.browser.close();
            } catch (error: any) {
                logger.error('Failed to close Puppeteer browser: ' + error.message);
            }
        }
    }






    // Helper method to create result object
    private getResultObject(timestamp: Date, state: stateText, powerkW: number): MachineState {
        logger.info("Puppeteer getResultObject");
        return {
            machineOk: powerkW > 0.1 && state == stateText.OK,
            state: state,
            lastOk: powerkW > 0.1 ? timestamp : new Date(0),  // Example logic for lastOk timestamp
            lastNOK: powerkW <= 0.1 ? timestamp : new Date(0),  // Example logic for lastNOK timestamp
            power: powerkW
        };
    }





    private parsePixelToPower(powerIndicatorWidth: string): number {
        try {
            let widthNum = parseInt(powerIndicatorWidth.replace('px', ''), 10);
            return parseFloat(((widthNum * 30) / 358).toFixed(2));
        } catch {
            return -1.0;
        }
    }


}


export default LogoClient