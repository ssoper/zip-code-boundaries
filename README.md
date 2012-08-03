# Zip codes

Unable to find a suitable data source for zip codes and their boundaries, I hacked up this node script to go out and do it for me. It uses the Census data from 2000, the latest that is publicly available. After it's done you should have a ~103mb JSON file in [GeoJSON format](http://www.geojson.org) ready to be used by packages such as [d3.js](http://d3js.org). If you want the output in a different format feel free to fork your own version and have at it.

## Use

    npm install
    node index

## Dependencies

Other than what's listed in the `package.json`, it requires `unzip` to be in your `PATH`

## License

MIT License
