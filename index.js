require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const diskusage = require('diskusage');
const HJSON = require('hjson')
const fetch = require('node-fetch')
const async = require('async')
const memoryCache = require('memory-cache')
const bytes = require('bytes');
const activeConnections = require('./active_connections')

const FARMER_STORAGE = '/home/ubuntu/.xcore/shares'
const FARMER_CONFIG = '/home/ubuntu/.xcore/configs'

const app = express();

async function GetFarmerStorageMetric(storagePath) {
    const size = diskusage.checkSync(path.join(storagePath || FARMER_STORAGE));
    let output = ``
    output += `farmer_storage_available ${size.available}\n`;
    output += `farmer_storage_free ${size.free}\n`;
    output += `farmer_storage_total ${size.total}\n`;
    return output;
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

        const currentConnections = await activeConnections(configContents.rpcPort);
        output += `farmer_info{nodeid="${nodeID}",\
wallet="${configContents.paymentAddress}",\
address="${configContents.rpcAddress}",\
farmer_storage_allocation="${configContents.storageAllocation}"}\
 1\n\
farmer_port ${configContents.rpcPort}\n\
farmer_active_connections ${currentConnections}\n\
farmer_max_connections ${configContents.maxConnections}\n\
farmer_offer_backoff_limit ${configContents.offerBackoffLimit}\n\
farmer_storage_allocation_bytes ${bytes(configContents.storageAllocation)}\n`
        const storageMetric = await GetFarmerStorageMetric(configContents.storagePath);
        output += storageMetric;

        await fetch('https://api.internxt.com/contacts/' + nodeID)
            .then(res => res.json())
            .then((data) => {
                output += `farmer_contact{last_seen="${data.lastSeen}"} 1\n`;
                output += `farmer_contact_reputation ${data.reputation}\n`;
                output += `farmer_contact_response_time ${data.responseTime}\n`;
                output += `farmer_contact_timeout_rate ${data.timeoutRate}\n`;
                output += `farmer_space_available ${data.spaceAvailable === 'true' ? 1 : 0}\n`;
                return output;
            }).catch(err => console.log)
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
        console.error(err);
        res.status(500)
    }).finally(() => {
        res.end();
    })

})

app.listen(9093);