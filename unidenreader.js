var fs = require('fs');
var path = require('path');

var fname = process.argv[2]; // 0 = node, 1 = script, 2 = first argument (or undefined)

var DEBUG = false;

if (undefined === fname) {
	console.log("Please supply file name as argument.");
	return;
}

if (!fs.existsSync(fname)) {
	console.log("File not found! ["+fname+"]");
	return;
}

if (DEBUG) { console.log("Parsing "+fname); }
var file = fs.openSync(fname, 'r');

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

if (!verifyFourCC(file, "RIFF", 0)) { console.log("ERROR! Quitting!"); return -1; }
var riffLength = getRecordLength(file,0);
if (!verifyFourCC(file, "WAVE", 8)) { console.log("WARNING! Missing WAVE marker"); }
if (!verifyFourCC(file, "LIST", 12)) { console.log("ERROR! LIST chunk not detected! Quitting!"); return -1; }
var listLength = getRecordLength(file,12);
if (!verifyFourCC(file, "INFO", 20)) { console.log("WARNING! INFO chunk not detected!"); }

var unidChunkPresent = verifyFourCC(file, "unid", 12 + 4 + 4 + listLength);


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
	
	o[fourcc] = { };
	o[fourcc]['string'] = b.toString('utf-8', 0, getNullPosition(b));
	o[fourcc]['rawdata'] = b;

	if (DEBUG) { console.log("Set '"+fourcc+"' to: ["+o[fourcc]+"]:["+b+"]"); }
	return fourcc;
}

var chunkData = { };

chunkData['filename'] = path.basename(fname);

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

//	//eitehr I don't understand RIFF, or uniden screwed up. The following is to compensate
//	if ("IKEY" == chunkName) { pos+=4; }	

	length = getRecordLength(file,pos);
	if (DEBUG) { console.log("Next: "+pos+"("+length+")"); }
}

if (unidChunkPresent) {
	var pos = getNextChunkStartPos(file,12);
	getDataFromChunkAt(file,pos,chunkData);
}

fs.closeSync(file);

console.log(chunkData);

if (chunkData.hasOwnProperty('unid')) { console.log(chunkData['unid']['rawdata'].toString()); }
