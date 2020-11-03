/*
 * Created with @iobroker/create-adapter v1.29.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';

let timer: NodeJS.Timeout;

// Load your modules here, e.g.:
// import * as fs from "fs";

// Augment the adapter.config object with the actual types
// TODO: delete this in the next version
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace ioBroker {
        interface AdapterConfig {
            // Define the shape of your options here (recommended)
            // Or use a catch-all approach
            [key: string]: any;
        }
    }
}

interface lastScanReturnValue {
    id: string;
    state: ioBroker.State;
    object: ioBroker.Object;
}

class HarmonizeBatteryStates extends utils.Adapter {
    private static isOnScanning = false;
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'harmonize-battery-states',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        this.timerToStart();
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private onUnload(callback: () => void): void {
        try {
            if (timer) {
                clearTimeout(timer);
            }
            callback();
        } catch (e) {
            callback();
        }
    }

    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    /**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.message" property to be set to true in io-package.json
     */
    private async onMessage(obj: ioBroker.Message): Promise<void> {
        if (typeof obj === 'object' && obj.message) {
            if (obj.command === 'doScan') {
                // e.g. send email or pushover or whatever
                // this.log.info('send command');
                this.scanBatteryStates();
                // Send response in callback if required
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, 'scan ongoing', obj.callback);
                }
            } else if (obj.command === 'isOnScan') {
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, HarmonizeBatteryStates.isOnScanning.toString(), obj.callback);
                }
            } else if (obj.command === 'getLastScan') {
                if (obj.callback) {
                    if (HarmonizeBatteryStates.isOnScanning === true) {
                        this.sendTo(obj.from, obj.command, { err: 'on scanning' }, obj.callback);
                    }
                    const adapterStates = await this.getStatesAsync('states.*');
                    const returnValue: lastScanReturnValue[] = [];
                    for (const [key, value] of Object.entries(adapterStates)) {
                        const obj = await this.getObjectAsync(key);
                        returnValue.push({
                            id: key,
                            state: value,
                            object: <ioBroker.Object>obj,
                        });
                    }
                    if (adapterStates) {
                        this.sendTo(obj.from, obj.command, returnValue, obj.callback);
                    } else {
                        this.sendTo(obj.from, obj.command, { err: 'nothing found' }, obj.callback);
                    }
                }
            }
        }
    }

    /**
     * This method scannes all battery states and updates/creates the adapter states
     */
    private async scanBatteryStates(): Promise<void> {
        if (HarmonizeBatteryStates.isOnScanning === true) {
            return;
        }
        HarmonizeBatteryStates.isOnScanning = true;
        this.log.info('scan started');
        const startTime = new Date().getTime();
        const objs = await this.getForeignObjectsAsync('*');
        const relObjs = [];
        const allBatteryStates: Array<string> = [];
        if (Array.isArray(this.config.default_role_list)) {
            const batteryRoles = this.config.default_role_list.map((v) => v.role);
            const adapterStates = await this.getStatesAsync('states.*');

            for (const [key, value] of Object.entries(objs)) {
                if ('common' in value && 'role' in value.common && batteryRoles.includes(value.common.role)) {
                    relObjs.push([key, value]);
                    const tempKey = key.split('.').join('_=_');
                    allBatteryStates.push(tempKey);
                }
            }

            // proceed the ones no longer exists
            const stateNoLongerExists = Object.keys(adapterStates).filter(
                (x) => !allBatteryStates.includes(x.substring(x.lastIndexOf('.') + 1)),
            );
            for (const e in stateNoLongerExists) {
                const id = 'states.' + stateNoLongerExists[e].substring(stateNoLongerExists[e].lastIndexOf('.') + 1);
                const ob = await this.getObjectAsync(id);
                if (ob) {
                    ob.native.reachable = false;
                    ob.native.last_ts = ob.ts;
                    await this.setObjectAsync(id, <ioBroker.SettableObject>ob);
                    await this.setStateChangedAsync(id, '', false);
                    this.sendToPushover(
                        `Battery State: ${ob.common.name} no longer available`,
                        `
                            <p>Battery State: ${ob.common.name} no longer available</p>
                            <p>The state (org_id) : ${ob.native.org_id}</p>
                            <p>Last Timestamp : ${new Date(ob.native.last_ts).toLocaleString()}</p>
                            <p>From Adapter : ${ob.native.org_adapter}</p>
                        `,
                        1,
                    );
                }
            }

            // proceed with all existing battery states
            for (const e in relObjs) {
                const org_id = <string>relObjs[e][0];
                const id = 'states.' + org_id.split('.').join('_=_');
                const org_obj = <ioBroker.Object>relObjs[e][1];
                const org_state = <ioBroker.State>await this.getForeignStateAsync(org_obj._id);
                const single_id = id.substring(id.lastIndexOf('.') + 1);

                // get channelName and deviceName if available
                let channelName = '';
                let deviceName = '';
                let tmpID = org_id.substring(0, org_id.lastIndexOf('.'));
                while (tmpID.lastIndexOf('.') != -1) {
                    const tmpObject = await this.getForeignObjectAsync(tmpID);
                    if (tmpObject && (tmpObject.type === 'device' || tmpObject.type === 'channel')) {
                        if (tmpObject.type === 'device') {
                            deviceName = <string>tmpObject.common.name;
                        }
                        if (tmpObject.type === 'channel') {
                            channelName = <string>tmpObject.common.name;
                        }
                    }
                    tmpID = tmpID.substring(0, tmpID.lastIndexOf('.'));
                }
                const readable_name =
                    deviceName != '' ? deviceName : channelName != '' ? channelName : org_obj.common.name;

                // check if a org_state is available (if state available but the org_state --> handle as not reachable)
                if (!(org_state && org_state.val !== null)) {
                    if (allBatteryStates.includes(single_id)) {
                        const existing_ob = await this.getObjectAsync(id);
                        if (existing_ob) {
                            existing_ob.native.reachable = false;
                            existing_ob.native.last_ts = existing_ob.ts;
                            await this.setObjectAsync(id, <ioBroker.SettableObject>existing_ob);
                            await this.setStateChangedAsync(id, '', false);
                        }
                    }
                    continue;
                }

                // calculate the val for the state
                let val: boolean | number;
                val = true;
                const default_role = this.config.default_role_list.find((e) => e.role === org_obj.common.role);
                if (default_role && 'type' in default_role && default_role.type === 'boolean') {
                    val = org_state.val === 0 || org_state.val === false || org_state.val === 'false' ? false : true;
                } else if (default_role && 'type' in default_role && default_role.type === 'number') {
                    if (default_role && 'default_low_percentage' in default_role) {
                        val = default_role.default_low_percentage >= <number>org_state.val;
                    } else {
                        this.log.error('Unknown role or low_percentage error with state:' + org_id);
                    }
                } else {
                    this.log.error('Unknown type error with state:' + org_id);
                }

                // check if existing state
                if (Object.keys(adapterStates).find((e) => e.includes(id))) {
                    // already exists --> update the object and state
                    const existing_ob = await this.getObjectAsync(id);
                    if (existing_ob) {
                        existing_ob.common.name = readable_name;
                        existing_ob.native.reachable = true;
                        existing_ob.native.last_ts = existing_ob.ts;
                        existing_ob.native.org_state_name = org_obj.common.name;
                        existing_ob.native.org_channel_name = channelName;
                        existing_ob.native.org_device_name = deviceName;
                        existing_ob.native.org_state = org_state;
                        existing_ob.native.org_common_type = org_obj.common.type;
                        existing_ob.native.org_common_role = org_obj.common.role;
                        if ('native' in org_obj && 'org_enum_area' in org_obj.native) {
                            existing_ob.native.org_enum_area = org_obj.native.org_enum_area;
                        }
                        if ('native' in org_obj && 'org_enum_floor' in org_obj.native) {
                            existing_ob.native.org_enum_floor = org_obj.native.org_enum_floor;
                        }
                        if ('native' in org_obj && 'org_enum_rooms' in org_obj.native) {
                            existing_ob.native.org_enum_rooms = org_obj.native.org_enum_rooms;
                        }
                        if ('native' in org_obj && 'org_enum_home' in org_obj.native) {
                            existing_ob.native.org_enum_home = org_obj.native.org_enum_home;
                        }

                        await this.setObjectAsync(id, <ioBroker.SettableObject>existing_ob);
                        await this.setStateChangedAsync(id, val, false);
                        this.sendToInflux(`battery_scanner_${org_obj._id}`, val);
                        if (val === true) {
                            this.sendToPushover(
                                `Battery is low: ${readable_name}`,
                                `
                                    <p>Battery State low: ${readable_name}</p>
                                    <p>State (org_id) : ${org_obj._id}</p>
                                    <p>Time : ${new Date().toLocaleString()}</p>
                                    <p>From Adapter : ${existing_ob.native.org_adapter}</p>
                                    <p>Original State Type : ${org_obj.common.type}</p>
                                    <p>Original State value : ${org_state.val}</p>
                                `,
                                1,
                            );
                        }
                    }
                } else {
                    // not yet exists --> create the object and state
                    const obj_val: ioBroker.SettableObject = {
                        type: 'state',
                        common: {
                            name: readable_name,
                            type: 'boolean',
                            role: 'value.lowBatteryHarmonized',
                            read: true,
                            write: false,
                        },
                        native: {
                            reachable: true,
                            org_state_name: org_obj.common.name,
                            org_id: org_obj._id,
                            org_adapter: org_obj.from,
                            org_channel_name: channelName,
                            org_state: org_state,
                            org_common_type: org_obj.common.type,
                            org_common_role: org_obj.common.role,
                        },
                    };
                    if ('native' in org_obj && 'org_enum_area' in org_obj.native) {
                        obj_val.native.org_enum_area = org_obj.native.org_enum_area;
                    }
                    if ('native' in org_obj && 'org_enum_floor' in org_obj.native) {
                        obj_val.native.org_enum_floor = org_obj.native.org_enum_floor;
                    }
                    if ('native' in org_obj && 'org_enum_rooms' in org_obj.native) {
                        obj_val.native.org_enum_rooms = org_obj.native.org_enum_rooms;
                    }
                    if ('native' in org_obj && 'org_enum_home' in org_obj.native) {
                        obj_val.native.org_enum_home = org_obj.native.org_enum_home;
                    }
                    await this.setObjectNotExistsAsync(id, obj_val);
                    await this.setStateAsync(id, val, true);
                    this.sendToInflux(`battery_scanner_${org_obj._id}`, val);
                    if (val === true) {
                        this.sendToPushover(
                            `Battery is low: ${readable_name}`,
                            `
                                <p>Battery State low: ${readable_name}</p>
                                <p>The state (org_id) : ${org_obj._id}</p>
                                <p>Time : ${new Date().toLocaleString()}</p>
                                <p>From Adapter : ${org_obj.from}</p>
                                <p>Original State Type : ${org_obj.common.type}</p>
                                <p>Original State value : ${org_state.val}</p>
                            `,
                            1,
                        );
                    }
                }
            }
            await this.setObjectNotExistsAsync('lastScan', {
                type: 'state',
                common: {
                    name: 'lastScan',
                    type: 'number',
                    role: 'date',
                    read: true,
                    write: false,
                },
                native: {},
            });
            const now = Date.now();
            this.setStateAsync('lastScan', now, true);
            HarmonizeBatteryStates.isOnScanning = false;
            const endTime = new Date().getTime();
            this.log.info('scan finished in : ' + (endTime - startTime).toString() + ' ms');
            this.sendToInflux('Battery state scan time', endTime - startTime);
        }
    }

    private async sendToPushover(title: string, message: string, priority: number): Promise<void> {
        if (this.config.alarm_to_pushover) {
            await this.sendToAsync('pushover', {
                message: message,
                title: title,
                priority: priority,
                html: 1,
            });
        }
    }

    private async sendToInflux(id: string, val: any): Promise<void> {
        if (this.config.alarm_to_influx) {
            await this.sendTo('influxdb', 'storeState', {
                id: id,
                state: { ts: Date.now(), val: val, ack: true, from: 'device-availability', q: 0 },
            });
        }
    }

    private async timerToStart(): Promise<void> {
        timer = setTimeout(() => this.timerToStart(), this.config.scan_interval);
        this.log.info('Timer started scanBatteryStates');
        await this.scanBatteryStates();
        this.log.info('Timer finished scanBatteryStates');
    }
}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new HarmonizeBatteryStates(options);
} else {
    // otherwise start the instance directly
    (() => new HarmonizeBatteryStates())();
}
