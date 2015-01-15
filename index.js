var fs = require('fs');
var path = require('path');

var DEBUG = false;

module.exports = function(fname, callback) {
	var err;
	var chunkData = { };

	chunkData['filename'] = path.basename(fname);

	if (typeof fname === 'undefined' || "" == fname) {
		err = new Error("No Filename provided!");
	} else if (!fs.existsSync(fname)) {
		err = new Error("File does not exist! ["+fname+"]");
	}

	if (DEBUG) { console.log("Parsing "+fname); }
	var file = fs.openSync(fname, 'r');


	if (!verifyFourCC(file, "RIFF", 0)) { err = new Error("File parsing error [missing RIFF marker]"); }
	chunkData['riff-length'] = getRecordLength(file,0); //the total length as reported by the header (might differ from file size in some conditions)
	if (!verifyFourCC(file, "WAVE", 8)) { if (DEBUG) { console.log("WARNING! WAVE marker not detected. This really should not happen..."); } }
	if (!verifyFourCC(file, "LIST", 12)) { err = new Error("LIST chunk not detected"); }

	var listLength = getRecordLength(file,12);
	if (!verifyFourCC(file, "INFO", 20)) { if (DEBUG) { console.log("WARNING! INFO chunk not detected!"); } }
	var unidChunkPresent = verifyFourCC(file, "unid", 12 + 4 + 4 + listLength);

	if (typeof err === 'undefined') {
		var pos = 24; //starting position of first subchunk (should be INFO) of LIST.
		var length = 0;

		var b = new Buffer(1);
		do {
			fs.readSync(file, b, 0, 1, pos)
			if (0x00==b[0]) { pos++; }
		} while (0x00==b[0] && (pos<(24+listLength)));

		while ((pos+length)<getNextChunkStartPos(file,12)) {
			var chunkName = getDataFromChunkAt(file, pos, chunkData);
			pos = getNextChunkStartPos(file,pos);

			length = getRecordLength(file,pos);
			if (DEBUG) { console.log("Next: "+pos+"("+length+")"); }
		}

		if (unidChunkPresent) {
			var pos = getNextChunkStartPos(file,12);
			getDataFromChunkAt(file,pos,chunkData);
		}
	}

	fs.closeSync(file);

	if (DEBUG) {
		console.log(chunkData);
		if (chunkData.hasOwnProperty('unid')) { console.log(chunkData['unid']['rawdata'].toString()); }
	}

	callback(err, chunkData);
}



function getFourCCAt(file, position) {
	var b = new Buffer(4);
	fs.readSync(file, b, 0, 4, position);
	return b.toString();
}

function verifyFourCC(file, fourcc, position) {
	var b = getFourCCAt(file,position);
	if (fourcc == b) {
		if (DEBUG) { console.log("Detected FourCC '"+fourcc+"' in expected position of "+position); }
		return true;
	} else {
		if (DEBUG) { console.log("Expected '"+fourcc+"' at "+position+" but found '"+b+"'"); }
		return false;
	}
}

function getRecordLength(file, position) {
	var b = new Buffer(4);
	fs.readSync(file, b, 0, 4, position+4);
	var result = (b[3]<<24)+(b[2]<<16)+(b[1]<<8)+b[0];
	if (DEBUG) { console.log("Found Record Length: "+result); }
	return result;
}



//given the starting position of a known chunk, return the starting position of the next chunk, if any. (not guaranteed that there is one, compare to expected total record length to verify you don't step out of bounds.
function getNextChunkStartPos(file,pos) {
	var chunklength = getRecordLength(file,pos);
	return pos+8+chunklength;
}

//return the position of first occorance of null, or the length of the buffer otherwise
function getNullPosition(b) {
	for (i=0; i<b.length; i++) {
		if (0x00 == b[i]) {
			return i;
		}
	}
	return i;
}


function getDataFromChunkAt(file,pos,o) {
	var fourcc = getFourCCAt(file,pos);
	var chunklength = getRecordLength(file,pos);
	var b = new Buffer(chunklength);
	fs.readSync(file, b, 0, chunklength, pos+8);

	j = 0;
	k = 0;
	dataArr = [];
	lastWasNull=false;
	for (i=0; i<chunklength; i++) {
		if (0x00 == b[i]) {
			k=0;
			lastWasNull=true;
		} else {
			if (lastWasNull) { j=j+1; }

			if (null == dataArr[j]) {
				dataArr[j] = [];
			}
			dataArr[j][k++] = b[i];

		}
	}

	o[fourcc] = { };
	o[fourcc]['elements'] = dataArr;
	o[fourcc]['string'] = String.fromCharCode.apply(null, dataArr[0]);
	o[fourcc]['rawdata'] = b;

	if (DEBUG) { console.log("Set '"+fourcc+"' to: ["+o[fourcc]+"]:["+b+"]"); }
	return fourcc;
}
