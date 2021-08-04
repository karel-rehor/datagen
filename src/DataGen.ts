#!./node_modules/.bin/ts-node

// import {InfluxDB, Point, HttpError} from '@influxdata/influxdb-client'

import {addTimestampToRecs, addStaggerTimestampToRecs} from './Utils';
import {query, writeLP, InfluxParams} from './Client'
import * as fs from "fs";
import * as dgconfig from '../dgconfig.json'

const appRoot = __dirname.substr(0, __dirname.lastIndexOf('/'))
let sourceFile = 'data/futuroscope02.lp'
let interval = "";
let timeDif = "-0s";
let argv = process.argv;

if(dgconfig.skipVerify)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED='0'

argv.shift();
argv.shift()
if(argv.length === 0){
    usage();
    process.exit(0)
}

while(argv.length > 0){
    switch(argv[0]){
        case '-s':
        case '--source':
            argv.shift();
            sourceFile = argv[0];
            break;
        case '-i':
        case '--interval':
            argv.shift();
            interval = argv[0]
            break;
        case '-t':
        case '--timedif':
            argv.shift();
            timeDif = argv[0]
            break;
        default:
            console.error(`Unknown argument ${argv[0]}\n`);
            usage();
            process.exit(1);
    }
    argv.shift()
}

function usage(){
    console.log('\nDataGen.ts -s [sourcefile] --timeDif [TimeDifference] --interval [TimeInterval]')
    console.log('')
    console.log('The purpose of DataGen.ts is to add the timestamps and write the data from a sourcefile to an influxdb bucket')
    console.log('Influxdb connect properties are read from ../scripts/influx_env.sh')
    console.log('\nparameters:\n')
    console.log('  -s|--source     - source file containing preliminary line protocol data')
    console.log('  -t|--timedif    - time difference from now from when to start writing data e.g. -1440m')
    console.log('  -i|--interval   - time interval between data points, e.g. 40m')
    console.log('')
    console.log('Preliminary line protocol data is line protocol data missing final timestamps.')
}

const dbParams: InfluxParams = {
    url: process.env.DG_ENDPOINT ?? dgconfig.endpoint,
    token: process.env.DG_TOKEN ?? dgconfig.token,
    org: process.env.DG_ORG ?? dgconfig.org,
    bucket: process.env.DG_BUCKET ?? dgconfig.bucket
}

const data = fs.readFileSync(`${appRoot}/${sourceFile}`, 'utf-8');

const lines = data.split('\n');

const writeLines = async (lines: string[]) => {
    if(dgconfig.verbose) {
        console.log('Writing lines')
        lines.forEach((line) => {
            console.log(line);
        });
    }
    await writeLP(dbParams, "ms", lines).catch(err => {
        console.error("CAUGHT ERROR: " + err)
    });
}

if(interval.length !== 0){
    if(timeDif === '-0s'){timeDif = '-1800s'}
    addStaggerTimestampToRecs(lines, timeDif, interval).then(writeLines)
}else{
    if(timeDif === '-0s'){timeDif = '-30m'}
    addTimestampToRecs(lines, timeDif).then(writeLines)
}

