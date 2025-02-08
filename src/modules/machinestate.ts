import { EventEmitter } from "stream";
import logger from "./logger";


export enum stateText{
    OK = "Anlage OK",
    NOK = "Anlage Fehler",
    UNKNOWN = "Zustand nicht bekannt"
}

export interface MachineState{
    machineOk : boolean
    state : stateText,
    lastOk : Date,
    lastNOK : Date,
    power : number
}


export class MachineStateHandler extends EventEmitter {

    state : MachineState = {
        machineOk: false,
        state: stateText.OK,
        lastOk: new Date(),
        lastNOK: new Date(),
        power: 0
    }

    private minOkTime: number;
    private okStateActive: boolean = false;

    constructor(minOkTime: number){
        super();
        this.minOkTime = minOkTime * 1000 * 60 //Convert to millseconds
    }

    update(newState : MachineState){
        logger.info("Updating state")
        logger.info(newState.state.toString())
        this.state.power = newState.power
        this.state.state = newState.state
        this.state.machineOk = newState.machineOk


        if(this.state.machineOk){
            this.state.lastOk = newState.lastOk

            //Still ok, nothing to do
            if(this.okStateActive == true) return;

            const diffMilli = this.state.lastOk.getTime() - this.state.lastNOK.getTime()
            //if time difference of new ok time to the last ok time > than the the configured min. ok time, reset error state
            if(diffMilli >= this.minOkTime){
                this.okStateActive = true
                this.emit('machineStateOK', this.state)
            }
        }
        else{
            this.state.lastNOK = newState.lastNOK
            if(this.okStateActive == false) return;
            this.okStateActive = false
            this.emit('machineStateNOK', this.state)
        }
    }


    
    toString(){
        const msg = `
${this.state.state != stateText.OK ? "ACHTUNG!" : "---"}\n
OK: ${this.formatDate(this.state.lastOk)}\n
Letzter Fehler: ${this.formatDate(this.state.lastNOK)}\n
Leistung (kW): ${this.state.power}\n
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
