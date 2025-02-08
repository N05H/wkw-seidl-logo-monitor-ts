

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


class MachineStateHandler {

    state : MachineState = {
        machineOk: false,
        state: stateText.OK,
        lastOk: new Date(),
        lastNOK: new Date(),
        power: 0
    }

    constructor(){
        
    }

}


export default MachineStateHandler;