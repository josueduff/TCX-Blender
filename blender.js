/*
    A mutiple-file uploader and option form
    to choose what values to keep from which
    files and then merge them into a new file.
    
    eg:
    --------Keep--------
    \                   \
    /     file1   file2 /
    \ hr    *           \
    / cad   *           /
    \ pwr          *    \
    / speed        *    /
    --------------------

*/

//TODO: Add icons to UI for position and altitude
document.getElementById("select-files").addEventListener("change", function(e) {
    var fr = new FileReader();
    var filesRead = [];
    
    var currFile = 0;
    var t0= performance.now();
    function readFiles() {
        if (currFile < e.target.files.length) {
            var file = e.target.files[currFile];

            fr.onloadend = function(loadEvent) {
                filesRead.push([file.name, loadEvent.target.result]);
                readFiles();
            }
            console.log(file);
            fr.readAsText(file);
            currFile++;
        } else {
            for (var i = 0; i < filesRead.length; i++) {
                extractValues(filesRead[i][0], filesRead[i][1]);
            }

            populateTable();
            var t1 = performance.now();
            console.log("Loading and parsing files took: " + ((t1 - t0) / 1000) + " seconds.");
        }
    }
    readFiles();
    
},false);

function populateTable() {
    var optionForm = document.getElementById("options");
    var rows = "<header>\n";
    
    globalValues.forEach(function(value) {
        rows += '<h5 class="' + value + '">' + value[0].toUpperCase() + value.substring(1) + '</h5>\n';
    });

    //All files have at least one lap, so this one is on by default
    rows += '<h5 class="laps">Laps</h5></header>\n';

    files.forEach(function(file) {
        var rowString =
        '<div class="row">' +
            '<h4>' + file.name + '</h4>';

        globalValues.forEach(function(value) {
            //Build the row and mark disabled if the file does not have the value for the column.
            rowString += '<label><input type="radio" name="' + value + '"' + ((!file.values[value]) ? "disabled" : "") + '></label>';
        });

        rowString += '<label><input type="radio" name="laps"></label>';            
        rowString += '</div>\n';
        rows += rowString;
    });

    optionForm.innerHTML += rows;
}

var files = [];
var globalValues = [];

function extractValues(fileName, fileString) {    
    var t0 = performance.now();
    var oParser = new DOMParser();
    
    var result = fileString;
    //Sometimes some devices add extra unnecessary precision
    result = result.replace(new RegExp('.000Z', 'g'), 'Z');
    
    //file.laps access is incremented while trackpoints is searched. Hence array and map respectively.
    var file = { name: fileName, laps: [], trackpoints: new Map(), values: {} };
    
    var fileDOM = oParser.parseFromString(result, "text/xml");
    
    file.values = {
        altitude : (result.indexOf("<AltitudeMeters>")   > -1 ),
        location : (result.indexOf("<LatitudeDegrees>")  > -1 ),
        speed    : (result.indexOf("<Speed>")            > -1 ),
        watts    : (result.indexOf("<Watts>")            > -1 ),
        
        //True if is the Cadence tag exists with any value
        cadence  : (result.indexOf("<Cadence>")          > -1 ),

        //True if a distance value exists larger than 0;
        distance : (result.search(new RegExp(/\<DistanceMeters\>(?=.*[1-9])\.?.*\d<\/DistanceMeters>/g)) > -1 ),

        //True if hr exists with a value larger than 10 (two digits)
        hr       : (result.search(new RegExp(/<HeartRateBpm>\s*<Value>\d{2,3}<\/Value>/g))     > -1 )
    }

    var valueKeys = Object.keys(file.values);
    for (var i = 0; i < valueKeys.length; i++) {
        if (file.values[valueKeys[i]] && !globalValues.includes(valueKeys[i])) {
            globalValues.push(valueKeys[i]);
        }
    }

    var laps = fileDOM.getElementsByTagName("Lap");
    for (var i = 0; i < laps.length; i++) {
        var lap = laps[i];

        file.laps.push({
            lapStartTime:        lap.getAttribute("StartTime"),
            totalTimeInSeconds:  lap.getElementsByTagName("TotalTimeSeconds")   [0].firstChild.nodeValue,
            distanceMeters:      lap.getElementsByTagName("DistanceMeters")     [0].firstChild.nodeValue,
            calories:            lap.getElementsByTagName("Calories")           [0].firstChild.nodeValue,
            averageHeartRateBpm: lap.getElementsByTagName("AverageHeartRateBpm")[0].getElementsByTagName("Value")[0].firstChild.nodeValue,
            maximumHeartRateBpm: lap.getElementsByTagName("MaximumHeartRateBpm")[0].getElementsByTagName("Value")[0].firstChild.nodeValue,
            intesity:            "Active",
            cadence:             lap.getElementsByTagName("Cadence")[0].firstChild.nodeValue,
            triggerMethod:       "Manual",
        });
    }

    var hrTrackpoints = fileDOM.getElementsByTagName("Trackpoint");

    for (var i = 0; i < hrTrackpoints.length; i++) {
        var trackpoint = hrTrackpoints[i];

        var newTrackpoint = {};

        var time     = trackpoint.getElementsByTagName("Time")              [0];

        var lat      = trackpoint.getElementsByTagName("LatitudeDegrees")   [0];
        var long     = trackpoint.getElementsByTagName("LongitudeDegrees")  [0];
        var speed    = trackpoint.getElementsByTagName("Speed")             [0];
        var watts    = trackpoint.getElementsByTagName("Watts")             [0];
        var cadence  = trackpoint.getElementsByTagName("Cadence")           [0];
        var distance = trackpoint.getElementsByTagName("DistanceMeters")    [0];
        var altitude = trackpoint.getElementsByTagName("AltitudeMeters")    [0];
        var hr       = trackpoint.getElementsByTagName("HeartRateBpm")      [0];

        //Set defaults
        if (lat)        { newTrackpoint.lat      = lat.firstChild.nodeValue;      }
        if (long)       { newTrackpoint.long     = long.firstChild.nodeValue;     }
        if (speed)      { newTrackpoint.speed    = speed.firstChild.nodeValue;    }
        if (watts)      { newTrackpoint.watts    = watts.firstChild.nodeValue;    }
        if (cadence)    { newTrackpoint.cadence  = cadence.firstChild.nodeValue;  }
        if (distance)   { newTrackpoint.distance = distance.firstChild.nodeValue; }
        if (altitude)   { newTrackpoint.altitude = altitude.firstChild.nodeValue; }
        if (hr)         { newTrackpoint.hr       = hr.getElementsByTagName("Value")[0].firstChild.nodeValue; }            

        //Store the values, with time as a key
        file.trackpoints.set(time.firstChild.nodeValue, newTrackpoint);
    }
    
    files.push(file);
    var t1 = performance.now();
    console.log("Values extracted and parsed. Took " + ((t1 - t0) / 1000) + " seconds.");
}


var output = [];

function merge() {
    //Add header
    output.push(`<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd"
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:ns2="http://www.garmin.com/xmlschemas/UserProfile/v2"
  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"
  xmlns:ns4="http://www.garmin.com/xmlschemas/ProfileExtension/v1">
  xmlns:ns5="http://www.garmin.com/xmlschemas/ActivityGoals/v1"
  <Activities>
    <Activity Sport="Biking">
      <Id>2016-11-22T17:01:40Z</Id>\n`);

    console.log("Starting merge");

    var t0 = performance.now();

    var lapKeys = Object.keys(laps);

    for (var i = 0; i < lapKeys.length; i++) {
        var lap = laps[lapKeys[i]];
        output.push(`<Lap StartTime="${ lapKeys[i] }">
            <TotalTimeSeconds>${lap.totalTimeSeconds}</TotalTimeSeconds>
            <DistanceMeters>${lap.distanceMeters}</DistanceMeters>
            <Calories>${lap.calories}</Calories>
            <AverageHeartRateBpm>
            <Value>${lap.averageHeartRateBpm}</Value>
            </AverageHeartRateBpm>
            <MaximumHeartRateBpm>
            <Value>${lap.maximumHeartRateBpm}</Value>
            </MaximumHeartRateBpm>
            <Intensity>Active</Intensity>
            <Cadence>${lap.cadence}</Cadence>
            <TriggerMethod>Manual</TriggerMethod>
            <Track>\n`);

        var trackpointKeys = Object.keys(lap.trackpoints); 
        for (var j = 0; j < trackpointKeys.length; j++) {
            var trackpoint = laps[lapKeys[i]].trackpoints[trackpointKeys[j]];

            var time = trackpointKeys[j];
            if (powerMap.has(time)) {
                output.push(`
                <Trackpoint>
                    <Time>${time}</Time>
                    <AltitudeMeters>0</AltitudeMeters>
                    <HeartRateBpm>
                        <Value>${trackpoint.heartRateBpm}</Value>
                    </HeartRateBpm>
                    <Cadence>${trackpoint.cadence}</Cadence>
                    <Extensions>
                        <ns3:TPX>
                            <ns3:Speed>0</ns3:Speed>
                            <ns3:Watts>${powerMap.get(time)}</ns3:Watts>
                        </TPX>
                    </Extensions>
                </Trackpoint>\n`);
            }
        }

        output.push(`</Track></Lap>\n`);
    }

    output.push(`<Creator xsi:type="Device_t">
        <Name>Garmin Edge 500</Name>
        <UnitId>3860056517</UnitId>
        <ProductID>1036</ProductID>
        <Version>
          <VersionMajor>3</VersionMajor>
          <VersionMinor>30</VersionMinor>
          <BuildMajor>0</BuildMajor>
          <BuildMinor>0</BuildMinor>
        </Version>
      </Creator>
    </Activity>
  </Activities>
  <Author xsi:type="Application_t">
    <Name>JD Merger</Name>
    <Build>
      <Version>
        <VersionMajor>1</VersionMajor>
        <VersionMinor>2</VersionMinor>
        <BuildMajor>0</BuildMajor>
        <BuildMinor>0</BuildMinor>
      </Version>
    </Build>
    <LangID>en</LangID>
    <PartNumber>006-D2449-00</PartNumber>
  </Author>
</TrainingCenterDatabase>`);

    var t1 = performance.now();
    console.log("Merge Complete, took " + ((t1 - t0) / 1000) + "seconds");
}

function download() {
    console.log("Preparing Download");
    var data = new Blob([output.join('')], {type: "text/plain"});
    var textFile = window.URL.createObjectURL(data);

    var link = document.createElement('a');
    link.setAttribute("download", "output.tcx");
    link.href = textFile;
    link.click();
}
