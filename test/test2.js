var unidenHeader = require('../index');


function arr2str(arr) {
	return String.fromCharCode.apply(null, arr);
}

unidenHeader(process.argv[2],function (e,d) {

	console.log("System: "+d['IART']['string']);
	console.log("Department: "+d['IGNR']['string']);
	console.log("Channel: "+d['INAM']['string']);
	console.log("Scanner: "+d['IPRD']['string']);
	var freq = ("HomePatrol"==d['IPRD']['string']) ? d['ICMT']['string'] : arr2str(d['unid']['elements'][34]);
	console.log("Frequency: "+ freq);
	
	console.log("-----------");

	if (null != d['unid']) {
		console.log("'unid' fields:");
		for (i=0; i<d['unid']['elements'].length; i++) {
			console.log(i+" : "+ arr2str(d['unid']['elements'][i]));
		}
	}

});

