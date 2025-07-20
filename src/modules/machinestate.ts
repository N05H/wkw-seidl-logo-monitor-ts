import { EventEmitter } from "stream";
import logger from "./logger";


export enum MachineStateText{
    OK = "Anlage OK",
    NOK = "Anlage Fehler",
    UNKNOWN = "Zustand nicht bekannt"
}

export interface MachineState{
    state : MachineStateText,
    lastOk : Date,
    lastNOK : Date
}

export interface MachinePerformance{
    power: number,
    lastMeasured: Date,
}


export class MachineStateHandler extends EventEmitter {

    state : MachineState = {
        state: MachineStateText.OK,
        lastOk: new Date(),
        lastNOK: new Date(),
    }

    performance: MachinePerformance = {
        lastMeasured: new Date(),
        power: 0
    }

    private minOkTime: number;

    constructor(minOkTime: number){
        super();
        this.minOkTime = minOkTime * 1000 * 60 //Convert to millseconds
    }

    updatePerformance(newPerformance: MachinePerformance){
        logger.info("Update performance")
        this.performance = newPerformance
    }

    updateState(newState : MachineState){
        if (newState.state != this.state.state)
            logger.info(`Updating state to ${newState.state.toString()}`)

        if(newState.state == MachineStateText.OK){
            this.state.lastOk = newState.lastOk

            //Still ok, nothing to do
            if (this.state.state == MachineStateText.OK) return;

            const diffMilli = this.state.lastOk.getTime() - this.state.lastNOK.getTime()
            //if time difference of new ok time to the last ok time > than the the configured min. ok time, reset error state
            if(diffMilli >= this.minOkTime){
                this.state.state = MachineStateText.OK;
                this.emit('machineStateOK', this)
                logger.info("MachineStateOK Event")
            }
        }
        else if(newState.state == MachineStateText.NOK){
            this.state.lastNOK = newState.lastNOK
            
            //Still NOK, nothing to do
            if (this.state.state == MachineStateText.NOK) return;

            //Set state to NOK since not already
            this.state.state = MachineStateText.NOK
            this.emit('machineStateNOK', this)
            logger.info("MachineStateNOK Event")
        }
        else if(newState.state == MachineStateText.UNKNOWN){
            
        }
    }


    
    toString(){
        const msg = `
${this.state.state != MachineStateText.OK ? "ACHTUNG!" : "---"}
OK: ${this.formatDate(this.state.lastOk)}
Letzter Fehler: ${this.formatDate(this.state.lastNOK)}
Leistung (kW): ${this.performance.power}
Status: ${this.state.state.toString()}
        `
        return msg
    }



    private formatDate(timeStampe: Date): string {
        const now = timeStampe
        const day = String(now.getDate()).padStart(2, '0');  // Adds leading zero if day < 10
        const month = String(now.getMonth() + 1).padStart(2, '0');  // getMonth() is 0-indexed
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
    }


}
