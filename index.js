require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const diskusage = require('diskusage');
const HJSON = require('hjson')
const fetch = require('node-fetch')
const async = require('async')
const memoryCache = require('memory-cache')

const FARMER_STORAGE = '/home/ubuntu/.xcore/shares'
const FARMER_CONFIG = '/home/ubuntu/.xcore/configs'

const app = express();

async function GetFarmerStorageMetric(path) {
    const size = diskusage.checkSync(path || FARMER_STORAGE);
    return `farmer_storage{available="${size.available}",free="${size.free}",total="${size.total}"} 1\n`;
}

async function GetFarmerNodeID() {
    const folderExists = fs.existsSync(FARMER_CONFIG);

    if (!folderExists) {
        return '';
    }
    const files = fs.readdirSync(FARMER_CONFIG)
    let output = '';
    await async.eachSeries(files, async (file) => {
        const configPath = file;
        const nodeID = file.match(/^([a-z0-9]{40})\.json$/)[1]
        const configContents = HJSON.parse(fs.readFileSync(path.join(FARMER_CONFIG, configPath)).toString());

        output += `farmer_info{nodeid="${nodeID}",\
wallet="${configContents.paymentAddress}",\
address="${configContents.rpcAddress}",\
port="${configContents.rpcPort}",\
max_connections="${configContents.maxConnections}",\
farmer_offer_backoff_limit="${configContents.offerBackoffLimit}",\
farmer_storage_allocation="${configContents.storageAllocation}"}\
 1\n`
        output += await GetFarmerStorageMetric(configContents.storagePath);

        await fetch('https://api.internxt.com/contacts/' + nodeID)
            .then(res => res.json())
            .then((data) => {
                output += `farmer_contact{reputation="${data.reputation}",response_time="${data.responseTime}",timeout_rate="${data.timeoutRate}",last_seen="${data.lastSeen}",space_available="${data.spaceAvailable}"} 1\n`;
                output += `farmer_contact_reputation ${data.reputation}\n`;
                output += `farmer_contact_response_time ${data.responseTime}\n`;
                return output;
            })
    })

    return output;

}

app.get('/metrics', (req, res) => {


    const cache = memoryCache.get('metrics')

    console.log('GET %d Cached: %s', new Date(), !!cache)

    if (cache) {
        res.status(200)
        res.setHeader('content-type', 'text/plain')
        res.write(cache)
        return res.end();
    }





    GetFarmerNodeID().then(result => {
        res.status(200)
        res.setHeader('content-type', 'text/plain')
        memoryCache.put('metrics', result, 6000)
        res.write(result)
        res.end();
    }).catch(err => {
        res.status(500)
    }).finally(() => {
        res.end();
    })

})

app.listen(9093);