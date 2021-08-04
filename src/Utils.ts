import * as fs from 'fs';

const second = 1000;
const minute = second * 60;
const hour = minute * 60;
const day = hour * 24;

interface TimeExpr {
    measure: number,
    unit: "s" | "ms" | "us" | "ns" | "m" | "h" | "d"
}


export interface GeoPoint {
    latDecDeg: number,
    lonDecDeg: number,
    latRad?: number,
    lonRad?: number
}

//following in km
const earthRadEqu = 6378.137
const earthRadPol = 6356.7523142
const earthRadMean = 6371.009


function parseTime(timeString: string){
    let result: TimeExpr = {measure: 0, unit: 's'};
    let range: string[] = timeString.match(/[-]?[0-9]*/)
    result.measure = parseInt(range.toString());
    let domain = timeString.match(/[mnus].*/).toString()
    // @ts-ignore
    result.unit = domain;
    return result;
}

/*assume number in ms*/
function calcTimeStamp(unit: string, prec: string, base: number){
    let msBase: number = 0;
    let now = new Date().getTime();

    switch(unit){
        case "s":
            msBase = base * second;
            break
        case "m":
            msBase = base * minute
            break
        case "h":
            msBase = base * hour;
            break;
        case "d":
            msBase = base * day;
            break;
        default:
            throw `Unhandled time unit ${unit}`
    }

    switch(prec){
        case "s":
            return (now / 1000) + (msBase / 1000);
        case "ms":
            return now + msBase;
        case "us":
            return (now * 1000) + (msBase * 1000);
        case "ns":
            return (now * 1000 * 1000 ) + (msBase * 1000 * 1000);
        default:
            throw `unhandled time precision definition ${prec}`
    }
}

export async function addTimestampToRecsFromFile(filePath: string, timeDif: string) {
    const data = fs.readFileSync(filePath, 'utf-8');
    const lines = data.split('\n');
    const now = new Date().getTime();
    let timeFrame: TimeExpr = parseTime(timeDif);

    //Todo use calcTime above
    let timeStamp = calcTimeStamp(timeFrame.unit, "ms", timeFrame.measure);
    let result: string[] = [];

    lines.forEach((line) => {
        if (line.trim().length > 0) {
            result.push(line + " " + timeStamp);
        }
    })

    return result;
}

// noinspection DuplicatedCode
export async function addTimestampToRecs(recs: string[], timeDif: string){

    let timeFrame: TimeExpr = parseTime(timeDif);
    let timeStamp = calcTimeStamp(timeFrame.unit, "ms", timeFrame.measure);
    let result: string[] = [];

    recs.forEach((line) => {
        if (line.trim().length > 0) {
            result.push(line + " " + timeStamp);
        }
    })

    return result;

}

function approxEqual(v1: number, v2: number, eps = 0.001): boolean{
    return Math.abs(v1 - v2) < eps;
}

export function rad2Deg(val: number): number {
    return val * 180.0/Math.PI
}

export function deg2Rad(val: number): number{
    return val * Math.PI/180.0
}

/*
* Helper function for GeoPoint interface
* TODO - move to class?
* */
export function calculateRadians(p: GeoPoint): GeoPoint{
    p.latRad = deg2Rad(p.latDecDeg);
    p.lonRad = deg2Rad(p.lonDecDeg);
    return p;
}

/*
* Calculates the haversine distance between two points
*
* Result is in radians unless distance is specified - e.g. earth circumference.
* */

export function haversineDistance(p1: GeoPoint, p2: GeoPoint, dist = 1.0): number{
    const dLat = p1.latRad - p2.latRad;
    const dLon = p1.lonRad - p2.lonRad;

    const x = Math.pow(Math.sin(dLat/2), 2) +
        Math.pow(Math.sin(dLon/2), 2) *
        Math.cos(p1.latRad) *
        Math.cos(p2.latRad);

    const haverVal = 2 * Math.asin(Math.sqrt(x));

    return haverVal * dist;
}

//This and some other methods taken from http://www.csgnetwork.com/marinegrcircalc.html

/*
* Calculates the basic constants and params for a Great Circle path
* based on two given points
* */
export function calcGCPath(start: GeoPoint, dest: GeoPoint){
    start = calculateRadians(start);
    dest = calculateRadians(dest);
    let lonDifRad = dest.lonRad - start.lonRad

//    console.log(`DEBUG dest.lon ${dest.lonRad} start.lonRad ${start.lonRad}`)
//    console.log("DEBUG lonDifRad " + lonDifRad)

    /* First calculate initial bearings */

    let signLonDif = 0-(lonDifRad/Math.abs(lonDifRad))

    if(Math.abs(lonDifRad) > Math.PI){
        lonDifRad = ((Math.PI * 2) - Math.abs(lonDifRad))*signLonDif
    }

    let radGCDist = (Math.sin(start.latRad)*Math.sin(dest.latRad)+
        Math.cos(start.latRad)*Math.cos(dest.latRad)*Math.cos(lonDifRad))
    radGCDist = Math.acos(radGCDist);


    if(approxEqual(radGCDist, Math.PI, 0.001)){
        throw(`Error: cannot calculate single path to antipodes ( ${JSON.stringify(start)} -> ${JSON.stringify(dest)} )`);
    }

    let radInitCourse = (Math.sin(dest.latRad)-Math.cos(radGCDist)*Math.sin(start.latRad))/
         (Math.sin(radGCDist)*Math.cos(start.latRad));

    radInitCourse = Math.acos(radInitCourse);

//    console.log("DEBUG lonDifRad " + lonDifRad)

    if(lonDifRad < 0){
        radInitCourse = (Math.PI * 2) - radInitCourse
    }

    /* Calculate constants */

    let radContX = Math.atan(Math.sin(start.latRad)*Math.tan(radInitCourse))

    if(Math.tan(radInitCourse) < 0){
        radContX = radContX + Math.PI;
    }

    let radContN = start.lonRad;

    if(start.lonRad < 0){
        radContN = radContN + (2 * Math.PI);
    }

    radContX = radContN - radContX;

    if(radContX < 0){
        radContX = radContX + (2 * Math.PI);
    }

    if(radContX > 2 * Math.PI){
        radContX = radContX - (2 * Math.PI);
    }

    let radConstK = Math.acos(Math.sin(radInitCourse)*Math.cos(start.latRad));

    if(radConstK === Math.PI/2){
        throw "Cannot set constant K to polar";
    }

    radConstK = Math.abs(Math.tan(radConstK))

    return {dist: radGCDist * earthRadMean, course: {init: rad2Deg(radInitCourse),
        constantX: radContX, constantK: radConstK}}
}

/*
* Calculates the latitude of a single waypoint based on
* a given longitude and constants
*
* Takes value in radians and returns in radians
* */
export function calcWaypointLat(lonRad: number, constX: number, constK: number): number{

    if(lonRad < 0){
        lonRad = lonRad + (2 * Math.PI);
    }

    let z = lonRad - constX;

    if(z < 0){
        z = z + (2 * Math.PI);
    }

    return Math.atan(Math.sin(z)*constK)
}

/*
* Calculates Way Points for an entire great circle
* */

export function calcCircleWayPoints(constX: number, constK: number, stepDegree = 10){

    let result: GeoPoint[] = [];

    for(let i = 0; i < 360; i += stepDegree){
        let tmpLon = i;
        if(tmpLon > 180){
            tmpLon -= 360
        }
        let tmpLat = calcWaypointLat(deg2Rad(tmpLon), constX, constK);
        console.log(`${rad2Deg(tmpLat)} ${tmpLon}`)
        result.push({lonRad: deg2Rad(tmpLon),
            latRad: tmpLat,
            lonDecDeg: tmpLon,
            latDecDeg: rad2Deg(tmpLat)})
    }

    return result;
}

/*
* Calculates the waypoints on a course segment
* of a great circle
* */

export function calcCourseWayPoints(constX: number,
                                    constK: number,
                                    start: GeoPoint,
                                    dest: GeoPoint,
                                    stepDegree = 10){
    start = calculateRadians(start);
    dest = calculateRadians(dest);

    let result: GeoPoint[] = [];
    let startLonNorm = start.lonRad < 0 ? start.lonRad + ( 2 * Math.PI) : start.lonRad;
    let destLonNorm = dest.lonRad < 0 ? dest.lonRad + ( 2 * Math.PI ) : dest.lonRad;
    let deltaLon = destLonNorm - startLonNorm; // N.B. ABS(deltaLon) should not be > PI
    console.log('DEBUG deltaLon ' + deltaLon)
    deltaLon = Math.abs(deltaLon) < Math.PI ? deltaLon : deltaLon > 0 ? deltaLon - (Math.PI * 2) : deltaLon + (Math.PI * 2)
    console.log('DEBUG deltaLon ' + deltaLon)
    let deltaLat = start.latRad - dest.latRad;
    let lonDir = deltaLon > 0; // + moving east, - moving west
    let latDir = deltaLat > 0; // + moving south, - moving north
    let eORn = deltaLon === 0 ? latDir : lonDir;

    console.log(`DEBUG startLonNorm ${startLonNorm} destLonNorm ${destLonNorm}`)

    if(eORn){
        console.log(`DEBUG moving eORn`)
        console.log(`DEBUG dif deltaLon ${deltaLon} > destLonNorm ${destLonNorm} ${deltaLon > destLonNorm}`)
        if(Math.abs(deltaLon) > Math.abs(destLonNorm)){
            console.log('Crossing Meridian')
            destLonNorm += Math.PI * 2;
        }
        //Moving east or north
        for(let pLon = startLonNorm; pLon <= destLonNorm; pLon += deg2Rad(stepDegree) ){
            let tmpLat = calcWaypointLat(pLon, constX, constK);
            let tmpLon = pLon > Math.PI ? pLon - (2 * Math.PI) : pLon;
            result.push({lonRad: tmpLon, latRad: tmpLat,
                lonDecDeg: rad2Deg(tmpLon), latDecDeg: rad2Deg(tmpLat)})
        }
    }else{
        console.log(`DEBUG moving wORs`)
        if(Math.abs(deltaLon) < Math.abs(destLonNorm)){
            console.log('Crossing Meridian')
            destLonNorm -= Math.PI * 2
        }
        //Moving west or south
        for(let pLon = startLonNorm; pLon >= destLonNorm; pLon -= deg2Rad(stepDegree) ){
            let tmpLat = calcWaypointLat(pLon, constX, constK);
            let tmpLon = pLon > Math.PI ? pLon - (2 * Math.PI) : pLon;
            result.push({lonRad: tmpLon, latRad: tmpLat,
                lonDecDeg: rad2Deg(tmpLon), latDecDeg: rad2Deg(tmpLat)})
        }
    }

    result.push(dest);

    return result;

}

//Let ‘R’ be the radius of Earth,
// ‘L’ be the longitude,
// ‘θ’ be latitude,
// ‘β‘ be Bearing.
//β = atan2(X,Y),
//X = cos θb * sin ∆L
//Y = cos θa * sin θb – sin θa * cos θb * cos ∆L
function calcBearing(a: GeoPoint, b: GeoPoint){
    a = calculateRadians(a);
    b = calculateRadians(b);

    let deltaLon = b.lonRad - a.lonRad;

    let x = Math.cos(b.latRad) * Math.sin(deltaLon)
    let y = (Math.cos(a.latRad) * Math.sin(b.latRad)) -
        (Math.sin(a.latRad) * Math.cos(b.latRad) * Math.cos(deltaLon));

    let bearing = Math.atan2(x,y);
    bearing = bearing < 0 ? bearing + (Math.PI * 2) : bearing;

    return rad2Deg(bearing);
}

function prepTags(tags: {key: string, vals: string[]}[], randomize = false){
    let result: string = '';
    let valIndex = 0;
    for(let i = 0; i < tags.length; i++){
        result += tags[i].key;

        if(randomize){
            result += `=${tags[i].vals[Math.floor(Math.random() * tags[i].vals.length)]}`;
        }else{
            result += `=${tags[i].vals[valIndex++ % tags[i].vals.length]}`
        }
        if(tags[i+1]){
            result += ','
        }
    }
//    console.log(`DEBUG result: ${result}`)
    return result;
}

/*
* Generates line protocol data except for time stamps
* over an entire great circle
* */

export function greatCircleLineProtocol(start: GeoPoint,
                                        dest: GeoPoint,
                                        tags = [{key: 'test', vals: ['testTag']}],
                                        meas = 'greatC')
    : string[]{
    start = calculateRadians(start);
    dest = calculateRadians(dest);

    let path = calcGCPath(start, dest);
    let gc = calcCircleWayPoints(path.course.constantX, path.course.constantK)

    let dataPts: string[] = [];
    let startLonNorm = start.lonRad < 0 ? start.lonRad + ( 2 * Math.PI) : start.lonRad;
    let destLonNorm = dest.lonRad < 0 ? dest.lonRad + ( 2 * Math.PI ) : dest.lonRad;
    let deltaLon = startLonNorm - destLonNorm;
    let deltaLat = start.latRad - dest.latRad;
    let lonDir = deltaLon > 0; // + moving east, - moving west
    let latDir = deltaLat > 0; // + moving south, - moving north
    let start2end = deltaLon === 0 ? latDir : lonDir;
    let distance = 0;
    let distSum = 0;
    let bearing = 0;
    if(start2end){
        for(let i = 0; i < gc.length; i++){
            let tagStr = prepTags(tags)
            distance = haversineDistance(gc[i], i < (gc.length - 1) ? gc[i+1] : gc[0])
            bearing = i < gc.length - 1 ? calcBearing(gc[i], gc[i+1]) : calcBearing(gc[i], gc[0]);
            distSum += distance;
            dataPts.push(`${meas},${tagStr} bearing=${bearing},dist=${distance},lat=${gc[i].latDecDeg},lon=${gc[i].lonDecDeg}`);
        }
    }else{
        for(let i = gc.length - 1; i >= 0; i--){
            let tagStr = prepTags(tags)
            distance = haversineDistance(gc[i], i > 0 ? gc[i-1] : gc[gc.length - 1])
            bearing = i < 0 ? calcBearing(gc[i], gc[i-1]) : calcBearing(gc[i],gc[gc.length - 1]);
            distSum += distance
            dataPts.push(`${meas},${tagStr} bearing=${bearing},dist=${distance},lat=${gc[i].latDecDeg},lon=${gc[i].lonDecDeg}`);
        }
    }

//    console.log(`DEBUG distSum ${distSum}`)
    return dataPts;

}

function prepFields(fields: {key: string, val: any}[]){
    let result: string = '';

    for(let i = 0; i < fields.length; i++){
        if(typeof(fields[i].val === 'function')){
            result += `${fields[i].key}=${fields[i].val()}`
        }else{
            result += `${fields[i].key}=${fields[i].val}`
        }
        if(fields[i+1]){ result += ','}
//        console.log(`DEBUG typeof fields[${i}].val ${typeof(fields[i].val)}`)
//        console.log(`DEBUG result ${result}`);
    }
    return result;
}

/*
* Generates line protocol except for time stamps
* For a course segment over a great circle
* */

export function greatCircleCourseLineProtocol(start: GeoPoint,
                                              dest: GeoPoint,
                                              stepDegree = 10,
                                              tags = [{key: 'test', vals: ['testTag']}],
                                              fields = [{key: 'myField', val: function (){return Math.floor(Math.random() * 10)} as any}],
                                              meas = 'gcCourse')
    :string []{

    start = calculateRadians(start);
    dest = calculateRadians(dest);

    let dataPts: string[] = [];

    let path = calcGCPath(start, dest);
    let course = calcCourseWayPoints(path.course.constantX,
        path.course.constantK,
        start,
        dest,
        stepDegree);

    let distance = 0;
    let bearing = 0;

    for(let i = 0; i < course.length; i++){
        let tagStr = prepTags(tags)
        let fieldStr = prepFields(fields);
        distance = haversineDistance(course[i], i < (course.length - 1) ? course[i+1] : dest, earthRadMean)
        bearing = i < course.length - 1 ? calcBearing(course[i], course[i+1]) : calcBearing(course[i], dest);
        dataPts.push(`${meas},${tagStr} ${fieldStr},bearing=${bearing},dist=${distance},lat=${course[i].latDecDeg.toFixed(8)},lon=${course[i].lonDecDeg.toFixed(8)}`);
    }

    return dataPts;
}

export async function addStaggerTimestampToRecs(recs: string[], timeDif: string, stagger: string){

    let result: string[] = []

    for(let i = 0; i < recs.length; i++){
        let timeFrame: TimeExpr = parseTime(timeDif);
        let staggerFrame: TimeExpr = parseTime(stagger);
        if(timeFrame.unit !== staggerFrame.unit){
            throw (`Time units do not match: ${timeFrame.unit} !== ${staggerFrame.unit}`)
        }
        if(recs[i].match(/.* .*/)){
            let timeStamp = calcTimeStamp(timeFrame.unit, "ms", timeFrame.measure + (staggerFrame.measure * i))
            result.push(recs[i] + " " + timeStamp);
        }
    }
    return result;
}







