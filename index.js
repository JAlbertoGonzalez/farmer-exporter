require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const diskusage = require('diskusage');
const HJSON = require('hjson')
const fetch = require('node-fetch')
const async = require('async')

const FARMER_STORAGE = '/home/ubuntu/.xcore/shares'
const FARMER_CONFIG = '/home/ubuntu/.xcore/configs'

const app = express();

async function GetFarmerStorageMetric() {
    const size = diskusage.checkSync(FARMER_STORAGE);
    return `farmer_storage_available ${size.available}\n\
farmer_storage_free ${size.free}\n\
farmer_storage_total ${size.total}`;
}

async function GetFarmerNodeID() {
    const files = fs.readdirSync(FARMER_CONFIG)
    let output = '';

    await async.eachSeries(files, (file, nextFile) => {
        const configPath = file;
        const nodeID = file.match(/^([a-z0-9]{40})\.json$/)[1]
        const configContents = HJSON.parse(fs.readFileSync(path.join(FARMER_CONFIG, configPath)).toString());

        output += `farmer_nodeid ${nodeID}\n`
        output += `farmer_wallet ${configContents.paymentAddress}\n`;
        output += `farmer_address ${configContents.rpcAddress}\n`;
        output += `farmer_port ${configContents.rpcPort}\n`;
        output += `farmer_max_connections ${configContents.maxConnections}\n`;
        output += `farmer_offer_backoff_limit ${configContents.offerBackoffLimit}\n`;
        output += `farmer_storage_allocation ${configContents.storageAllocation}\n`;

        console.log('---', nodeID)

        fetch('https://api.internxt.com/contacts/' + nodeID)
            .then(res => res.json())
            .then((data) => {
                output += `farmer_contact_reputation ${data.reputation}\n`;
                output += `farmer_contact_response_time ${data.responseTime}\n`;
                output += `farmer_contact_timeout_rate ${data.timeoutRate}\n`;
                output += `farmer_contact_last_seen ${data.lastSeen}\n`;
                output += `farmer_contact_space_available ${data.spaceAvailable}\n`;
                nextFile();
            }).catch((err) => nextFile());
    })

    return output;
}

app.get('/metrics', (req, res) => {

    Promise.all([
        GetFarmerNodeID(),
        GetFarmerStorageMetric()
    ]).then(result => {
        result.forEach(line => res.write(line))
    }).then(() => {
        res.status(200);
        res.end();
    })

})

app.listen(9093);