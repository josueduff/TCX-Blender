var hrFileInput = document.getElementById("hrFile");
var powerFileInput = document.getElementById("powerFile");

var laps = {};

var oParser = new DOMParser();

/*
    Have a mutiple-file uploader and and add option form
    to choose what values to keep from which files
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

hrFileInput.addEventListener("change", function() {
    console.log("HR uploading.");

    var file = hrFileInput.files[0];
    var fr = new FileReader();
    fr.onload = function(e) {
        console.log("HR upload complete, starting parse.");

        var t0 = performance.now();
        
        var result = e.target.result;
        
        result = result.replace(new RegExp('.000Z', 'g'), 'Z');
        
        var hrDOM = oParser.parseFromString(result, "text/xml");
        var domLaps = hrDOM.getElementsByTagName("Lap");

        for (var i = 0; i < domLaps.length; i++) {
            var lap = domLaps[i];
            var lapStartTime = lap.getAttribute("StartTime"); 

            //Map xml lap to json
            laps[lapStartTime] = {
                totalTimeInSeconds:  lap.getElementsByTagName("TotalTimeSeconds")   [0].firstChild.nodeValue,
                distanceMeters:      lap.getElementsByTagName("DistanceMeters")     [0].firstChild.nodeValue,
                calories:            lap.getElementsByTagName("Calories")           [0].firstChild.nodeValue,
                averageHeartRateBpm: lap.getElementsByTagName("AverageHeartRateBpm")[0].getElementsByTagName("Value")[0].firstChild.nodeValue,
                maximumHeartRateBpm: lap.getElementsByTagName("MaximumHeartRateBpm")[0].getElementsByTagName("Value")[0].firstChild.nodeValue,
                intesity:            "Active",
                cadence:             lap.getElementsByTagName("Cadence")[0].firstChild.nodeValue,
                triggerMethod:       "Manual",
                trackpoints: {}
            }

            var hrTrackpoints = lap.getElementsByTagName("Trackpoint");

            for (var j = 0; j < hrTrackpoints.length; j++) {
                var trackpoint = hrTrackpoints[j];
                var time    = trackpoint.getElementsByTagName("Time")        [0].firstChild.nodeValue;
                var hr      = trackpoint.getElementsByTagName("HeartRateBpm")[0];
                var watts   = trackpoint.getElementsByTagName("Watts")       [0];
                var cadence = trackpoint.getElementsByTagName("Cadence")     [0];

                //Add the available values to the trackpoint, set default value to 0 otherwise
                laps[lapStartTime].trackpoints[time] = {
                    heartRateBpm:   (hr)        ? hr.getElementsByTagName("Value")[0].firstChild.nodeValue : 0,
                    cadence:        (cadence)   ? cadence.nodeValue                                        : 0,
                    watts:          (watts)     ? watts.nodeValue                                          : 0
                }
            }
        }
        
        var t1 = performance.now();

        console.log("HR parse complete, took " + ((t1 - t0) / 1000) + " seconds");
    }
    fr.readAsText(file);
},false);


var powerMap = new Map();
powerFileInput.addEventListener("change", function() {
    console.log("Power uploading");
    var file = powerFileInput.files[0];
    var fr = new FileReader();
    fr.onload = function(e) {
        console.log("Power upload complete, starting parse.");
        var powerDOM = oParser.parseFromString(e.target.result, "text/xml");

        var powerTrackpoints = powerDOM.getElementsByTagName("Trackpoint");
        
        console.log("Power parse complete.");

        //Map the power values to their time stamps
        var i = 0;
        var length = powerTrackpoints.length;
        for (i = 0; i < length; i++) {
            powerTrackpoint = powerTrackpoints[i];
            var timeStamp = powerTrackpoint.getElementsByTagName("Time")[0].firstChild.nodeValue;
            var powerValue = powerTrackpoint.getElementsByTagName("Watts")[0].firstChild.nodeValue;

            powerMap.set(timeStamp, powerValue);
        }

        merge();
        download();
    }

    fr.readAsText(file);
},false);

var output = [];

function merge() {
    //Add header
    output.push(`<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd"
  xmlns:ns5="http://www.garmin.com/xmlschemas/ActivityGoals/v1"
  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"
  xmlns:ns2="http://www.garmin.com/xmlschemas/UserProfile/v2"
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ns4="http://www.garmin.com/xmlschemas/ProfileExtension/v1">
  <Activities>
    <Activity Sport="Biking">
      <Id>2016-11-22T17:01:40Z</Id>`);

    console.log("Starting merge");

    var t0 = performance.now();

    var lapKeys = Object.keys(laps);

    for (var i = 0; i < lapKeys.length; i++) {
        var lap = laps[lapKeys[i]];
        output.push(`
        <Lap StartTime="${ lapKeys[i] }">
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
            <Track>
                `);

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
                        <TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
                            <Speed>0</Speed>
                            <Watts>${powerMap.get(time)}</Watts>
                        </TPX>
                    </Extensions>
                </Trackpoint>
                `);
                //laps[lapKeys[i]].trackpoints[trackpointKeys[j]].power = powerMap.get(time);
            }
        }

        output.push(`</Track></Lap>`);
    }

    output.push(`
    <Creator xsi:type="Device_t">
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
