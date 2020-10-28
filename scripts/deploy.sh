#!/bin/bash

npm run build

# ssh root@192.168.90.1 rm -rf /opt/iobroker/node_modules/iobroker.harmonize-battery-states/www
# scp -r www root@192.168.90.1:/opt/iobroker/node_modules/iobroker.harmonize-battery-states/

ssh root@192.168.90.1 rm -rf /opt/iobroker/node_modules/iobroker.harmonize-battery-states/admin
scp -r admin root@192.168.90.1:/opt/iobroker/node_modules/iobroker.harmonize-battery-states/
scp -r io-package.json root@192.168.90.1:/opt/iobroker/node_modules/iobroker.harmonize-battery-states/

scp -r build root@192.168.90.1:/opt/iobroker/node_modules/iobroker.harmonize-battery-states/

ssh root@192.168.90.1 iobroker upload harmonize-battery-states