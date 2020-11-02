"use strict";
/*
 * Created with @iobroker/create-adapter v1.29.1
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
let timer;
class HarmonizeBatteryStates extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign(Object.assign({}, options), { name: 'harmonize-battery-states' }));
        this.on('ready', this.onReady.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady() {
        return __awaiter(this, void 0, void 0, function* () {
            this.timerToStart();
        });
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            if (timer) {
                clearTimeout(timer);
            }
            callback();
        }
        catch (e) {
            callback();
        }
    }
    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    /**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.message" property to be set to true in io-package.json
     */
    onMessage(obj) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof obj === 'object' && obj.message) {
                if (obj.command === 'doScan') {
                    // e.g. send email or pushover or whatever
                    // this.log.info('send command');
                    this.scanBatteryStates();
                    // Send response in callback if required
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, 'scan ongoing', obj.callback);
                    }
                }
                else if (obj.command === 'isOnScan') {
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, HarmonizeBatteryStates.isOnScanning.toString(), obj.callback);
                    }
                }
                else if (obj.command === 'getLastScan') {
                    if (obj.callback) {
                        if (HarmonizeBatteryStates.isOnScanning === true) {
                            this.sendTo(obj.from, obj.command, { err: 'on scanning' }, obj.callback);
                        }
                        const adapterStates = yield this.getStatesAsync('states.*');
                        const returnValue = [];
                        for (const [key, value] of Object.entries(adapterStates)) {
                            const obj = yield this.getObjectAsync(key);
                            returnValue.push({
                                id: key,
                                state: value,
                                object: obj,
                            });
                        }
                        if (adapterStates) {
                            this.sendTo(obj.from, obj.command, returnValue, obj.callback);
                        }
                        else {
                            this.sendTo(obj.from, obj.command, { err: 'nothing found' }, obj.callback);
                        }
                    }
                }
            }
        });
    }
    /**
     * This method scannes all battery states and updates/creates the adapter states
     */
    scanBatteryStates() {
        return __awaiter(this, void 0, void 0, function* () {
            if (HarmonizeBatteryStates.isOnScanning === true) {
                return;
            }
            HarmonizeBatteryStates.isOnScanning = true;
            this.log.info('scan started');
            const startTime = new Date().getTime();
            const objs = yield this.getForeignObjectsAsync('*');
            const relObjs = [];
            const allBatteryStates = [];
            if (Array.isArray(this.config.default_role_list)) {
                const batteryRoles = this.config.default_role_list.map((v) => v.role);
                const adapterStates = yield this.getStatesAsync('states.*');
                for (const [key, value] of Object.entries(objs)) {
                    if ('common' in value && 'role' in value.common && batteryRoles.includes(value.common.role)) {
                        relObjs.push([key, value]);
                        const tempKey = key.split('.').join('_=_');
                        allBatteryStates.push(tempKey);
                    }
                }
                // proceed the ones no longer exists
                const stateNoLongerExists = Object.keys(adapterStates).filter((x) => !allBatteryStates.includes(x.substring(x.lastIndexOf('.') + 1)));
                for (const e in stateNoLongerExists) {
                    const id = 'states.' + stateNoLongerExists[e].substring(stateNoLongerExists[e].lastIndexOf('.') + 1);
                    const ob = yield this.getObjectAsync(id);
                    if (ob) {
                        ob.native.reachable = false;
                        ob.native.last_ts = ob.ts;
                        yield this.setObjectAsync(id, ob);
                        yield this.setStateChangedAsync(id, '', false);
                        this.sendToPushover(`Battery State: ${ob.common.name} no longer available`, `
                            <p>Battery State: ${ob.common.name} no longer available</p>
                            <p>The state (org_id) : ${ob.native.org_id}</p>
                            <p>Last Timestamp : ${new Date(ob.native.last_ts).toLocaleString()}</p>
                            <p>From Adapter : ${ob.native.org_adapter}</p>
                        `, 1);
                    }
                }
                // proceed with all existing battery states
                for (const e in relObjs) {
                    const org_id = relObjs[e][0];
                    const id = 'states.' + org_id.split('.').join('_=_');
                    const org_obj = relObjs[e][1];
                    const org_state = yield this.getForeignStateAsync(org_obj._id);
                    const single_id = id.substring(id.lastIndexOf('.') + 1);
                    // get channelName and deviceName if available
                    let channelName = '';
                    let deviceName = '';
                    let tmpID = org_id.substring(0, org_id.lastIndexOf('.'));
                    while (tmpID.lastIndexOf('.') != -1) {
                        const tmpObject = yield this.getForeignObjectAsync(tmpID);
                        if (tmpObject && (tmpObject.type === 'device' || tmpObject.type === 'channel')) {
                            if (tmpObject.type === 'device') {
                                deviceName = tmpObject.common.name;
                            }
                            if (tmpObject.type === 'channel') {
                                channelName = tmpObject.common.name;
                            }
                        }
                        tmpID = tmpID.substring(0, tmpID.lastIndexOf('.'));
                    }
                    const readable_name = deviceName != '' ? deviceName : channelName != '' ? channelName : org_obj.common.name;
                    // check if a org_state is available (if state available but the org_state --> handle as not reachable)
                    if (!(org_state && org_state.val !== null)) {
                        if (allBatteryStates.includes(single_id)) {
                            const existing_ob = yield this.getObjectAsync(id);
                            if (existing_ob) {
                                existing_ob.native.reachable = false;
                                existing_ob.native.last_ts = existing_ob.ts;
                                yield this.setObjectAsync(id, existing_ob);
                                yield this.setStateChangedAsync(id, '', false);
                            }
                        }
                        continue;
                    }
                    // calculate the val for the state
                    let val;
                    val = true;
                    if (org_obj.common.type === 'boolean') {
                        val = org_state.val === 0 || org_state.val === false ? false : true;
                    }
                    else if (org_obj.common.type === 'number') {
                        const default_role = this.config.default_role_list.find((e) => e.role === org_obj.common.role);
                        if (default_role && 'default_low_percentage' in default_role) {
                            val = default_role.default_low_percentage >= org_state.val;
                        }
                        else {
                            this.log.error('Unknown role or low_percentage error with state:' + org_id);
                        }
                    }
                    else {
                        this.log.error('Unknown type error with state:' + org_id);
                    }
                    // check if existing state
                    if (Object.keys(adapterStates).find((e) => e.includes(id))) {
                        // already exists --> update the object and state
                        const existing_ob = yield this.getObjectAsync(id);
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
                            yield this.setObjectAsync(id, existing_ob);
                            yield this.setStateChangedAsync(id, val, false);
                            this.sendToInflux(`battery_scanner_${org_obj._id}`, val);
                            if (val === true) {
                                this.sendToPushover(`Battery is low: ${readable_name}`, `
                                    <p>Battery State low: ${readable_name}</p>
                                    <p>State (org_id) : ${org_obj._id}</p>
                                    <p>Time : ${new Date().toLocaleString()}</p>
                                    <p>From Adapter : ${existing_ob.native.org_adapter}</p>
                                    <p>Original State Type : ${org_obj.common.type}</p>
                                    <p>Original State value : ${org_state.val}</p>
                                `, 1);
                            }
                        }
                    }
                    else {
                        // not yet exists --> create the object and state
                        const obj_val = {
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
                        yield this.setObjectNotExistsAsync(id, obj_val);
                        yield this.setStateAsync(id, val, true);
                        this.sendToInflux(`battery_scanner_${org_obj._id}`, val);
                        if (val === true) {
                            this.sendToPushover(`Battery is low: ${readable_name}`, `
                                <p>Battery State low: ${readable_name}</p>
                                <p>The state (org_id) : ${org_obj._id}</p>
                                <p>Time : ${new Date().toLocaleString()}</p>
                                <p>From Adapter : ${org_obj.from}</p>
                                <p>Original State Type : ${org_obj.common.type}</p>
                                <p>Original State value : ${org_state.val}</p>
                            `, 1);
                        }
                    }
                }
                yield this.setObjectNotExistsAsync('lastScan', {
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
        });
    }
    sendToPushover(title, message, priority) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.config.alarm_to_pushover) {
                yield this.sendToAsync('pushover', {
                    message: message,
                    title: title,
                    priority: priority,
                    html: 1,
                });
            }
        });
    }
    sendToInflux(id, val) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.config.alarm_to_influx) {
                yield this.sendTo('influxdb', 'storeState', {
                    id: id,
                    state: { ts: Date.now(), val: val, ack: true, from: 'device-availability', q: 0 },
                });
            }
        });
    }
    timerToStart() {
        return __awaiter(this, void 0, void 0, function* () {
            timer = setTimeout(() => this.timerToStart(), this.config.scan_interval);
            this.log.info('Timer started scanBatteryStates');
            yield this.scanBatteryStates();
            this.log.info('Timer finished scanBatteryStates');
        });
    }
}
HarmonizeBatteryStates.isOnScanning = false;
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options) => new HarmonizeBatteryStates(options);
}
else {
    // otherwise start the instance directly
    (() => new HarmonizeBatteryStates())();
}
