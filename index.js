var htmlparser = require('htmlparser'),
    fs = require('fs'),
    request = require('request'),
    util = require('util'),
    async = require('async'),
    lodash = require('lodash'),
    exec = require('child_process').exec;

var serverName = 'http://www.census.gov';
var tmpDir = './tmp';

var handler = new htmlparser.DefaultHandler(function (error, dom) {
  if (error) {
    console.log(error);
    process.exit(1);
  } else {
    var body = dom[0];
    var states = []
    body.children.forEach(function(item) {
      var name = item.children[0].raw.slice(0, -3);
      var zipFile = serverName + item.children[1].attribs.href;
      states.push({
        name: name,
        zipFile: zipFile
      });
    });
    // console.log(states)
    
    fs.mkdir(tmpDir);
    var d3Filename = 'us-zipcodes.json';
    fs.writeFileSync(d3Filename, '{ "type": "FeatureCollection", "features": [\n');

    var outerCount = 0;
    async.forEachSeries(states, function(state, async_cb) {
      var filename = tmpDir + '/' + state.zipFile.split('/')[state.zipFile.split('/').length-1];
      console.log(filename)
      var writeStream = fs.createWriteStream(filename);
      writeStream.on('close', function(err) {
        console.log('Finished downloading ' + state.zipFile);
        var cmd = 'unzip ' + filename + ' -d ' + tmpDir;
        console.log(cmd)
        exec(cmd, function(err, stdout, stderr) {
          var output = stdout.split('\n');
          var files = output.reduce(function(memo, curr, index, ary) {
            if (ary[index].match(/inflating/)) {
              var data = ary[index].split(':')[1].trim();
              if (index == 1) {
                memo.zip = data;
              } else {
                memo.meta = data;
              }
            }

            return memo;
          }, {});

          var metaRaw = fs.readFileSync(files.meta, 'utf8').split('\n');
          var count = 0;
          var metaData = [];
          var length = 0;
          metaRaw.map(function(line) {
            if ((count%6) == 0) {
              length = metaData.push({ id: line.trim(), coords: [] });
            } else if ((count%6) == 1) {
              metaData[length-1].zipCode = line.trim().replace(/"/g, '');
            }
            count++;
          });
          metaData.shift();
          metaData.pop();

          var zipRaw = fs.readFileSync(files.zip, 'utf8').split('\n');
          var currMeta;
          zipRaw.forEach(function(line) {
            var parts = line.split(/\s+/);
            parts.shift();
            if (parts.length > 2) {
              currMeta = lodash.find(metaData, function(meta) {
                return meta.id == parts[0];
              });
              var lat = parseFloat(parts[1]).toPrecision(8);
              var lon = parseFloat(parts[2]).toPrecision(8)
              currMeta.coords.push([lat, lon]);
            } else if (parts.length == 2) {
              var lat = parseFloat(parts[0]).toPrecision(8);
              var lon = parseFloat(parts[1]).toPrecision(8)
              currMeta.coords.push([lat, lon]);
            }
          });

          var zipAreas = metaData.filter(function(elem, index, ary) {
            return elem.zipCode.match(/\d{5}/);
          })

          count = 0;
          zipAreas.forEach(function(zipArea) {
            var coords = JSON.stringify(zipArea.coords).replace(/"/g, '');
            var line = '{ "type": "Feature", "properties": {}, "id": "' + zipArea.zipCode + '", "geometry": { "type": "Polygon", "coordinates": ['+ coords + '] }}';
            if (count < zipAreas.length - 1 || outerCount < states.length - 1) {
              line = line + ',';
            }
            line = line + '\n';
            fs.appendFileSync(d3Filename, line);
            count++;
          });

          console.log(count + ' zip codes for ' + state.name);
          outerCount++;
          async_cb();
        });
      });

      console.log('Downloading ' + state.zipFile);
      request.get(state.zipFile).pipe(writeStream);
    }, function(err) {
      fs.appendFileSync(d3Filename, ']}');
    });
  }
});

var parser = new htmlparser.Parser(handler);
parser.parseComplete(fs.readFileSync('raw.html', 'utf8'));
