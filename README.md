### 0.0.2-4 (2020-10-29)
![Logo](admin/harmonize-battery-states.png)
# ioBroker.harmonize-battery-states

[![NPM version](http://img.shields.io/npm/v/iobroker.harmonize-battery-states.svg)](https://www.npmjs.com/package/iobroker.harmonize-battery-states)
[![Downloads](https://img.shields.io/npm/dm/iobroker.harmonize-battery-states.svg)](https://www.npmjs.com/package/iobroker.harmonize-battery-states)
![Number of Installations (latest)](http://iobroker.live/badges/harmonize-battery-states-installed.svg)
![Number of Installations (stable)](http://iobroker.live/badges/harmonize-battery-states-stable.svg)
[![Dependency Status](https://img.shields.io/david/swissglider/iobroker.harmonize-battery-states.svg)](https://david-dm.org/swissglider/iobroker.harmonize-battery-states)
[![Known Vulnerabilities](https://snyk.io/test/github/swissglider/ioBroker.harmonize-battery-states/badge.svg)](https://snyk.io/test/github/swissglider/ioBroker.harmonize-battery-states)

[![NPM](https://nodei.co/npm/iobroker.harmonize-battery-states.png?downloads=true)](https://nodei.co/npm/iobroker.harmonize-battery-states/)

**Tests:** ![Test and Release](https://github.com/swissglider/ioBroker.harmonize-battery-states/workflows/Test%20and%20Release/badge.svg)

## harmonize-battery-states adapter for ioBroker

Do have marmonized battery states this adapter do it for you

## Desciption

This adapter first of all creates for all baterry states found on the iobroker a new state.  
&rightarrow; New state has Role: value.lowBatteryHarmonized (boolean)   
&rightarrow; percentage when low can be configured in admin (default and per role)   
    
To achive this the following is done:
1) collect all states with the following role
    - value.battery (%)
    - battery.percent (%)
    - value.lowBatt (0/1)
2) Scann can also be done manually on admin
3) if the org state is no longer available, the new state will **further exists**. But the common parameter "reachable" will be false and the "last_seen" has the last state. There will be **no alarms** when reachable is false

## Admin Parameters
- Scan / Battery State update time in ms (milliseconds)
- Default percentage when a battery state will be low
- List of all the roles that was to be scanned. Default are:
  - value.battery (%)
  - battery.percent (%)
  - value.lowBatt (0/1)
- send alarm to pushover
- send alarm to influxdb

## value.lowBatteryHarmonized (object)

```json
{
    "type": "state",
    "common": {
        "name": $Name from org state/channel/device,
        "org_state_name": $org_state_name,
        "org_channel_name": $org_state_name,
        "org_device_name": $org_state_name,
        "type": "boolean",
        "role": "value.lowBatteryHarmonized",
        "read": true,
        "write": false,
        "min": true,
        "max": false,
        "def": false,
        "org_adapter": $name of the org adapter,
        "org_id": $org id,
        "org_state":{$org-state},
        "reachable": true,
        "last_seen": $ts,
    },
    "native": {
        "send_alarm": true,
    }
    "_id": "harmonize-battery-states.0.battery-low-states."$($org id),
}
```
&rightarrow; name and send_alarm can be configured on the admin panel.

## Wishlist

- Each adapter can be registered to get an alarm (the adapter must have an sendTo method with type:battery_alarm)   
  &rightarrow; ev. can be configured on admin...

## Changelog

### 0.0.2-5 (2020-10-30)
* (Swissglider) Admin part "General" and "Role Include" Tabs finished

### 0.0.2-4 (2020-10-29)
* (Swissglider) README.md added with the functional description
* (Swissglider) Addeed admin parameter to the io-package.json

### 0.0.1 (2020-10-28)
* (Swissglider) initial release

## License
MIT License

Copyright (c) 2020 Swissglider <npm@swissglider.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.