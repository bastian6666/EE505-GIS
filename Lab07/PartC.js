// Define a region of interest as a polygon
var region = ee.Geometry.Polygon(
        [[[-71.58620372466291, 42.6841632377306],
        [-71.58620372466291, 41.98982440584331],
        [-70.54524913481916, 41.98982440584331],
        [-70.54524913481916, 42.6841632377306]]]
        );

// Center the map on the defined region
Map.centerObject(region, 11);

// Load the 2021 NLCD data
var NLCD2021 = ee.Image('USGS/NLCD_RELEASES/2021_REL/NLCD/2021')
    .select('landcover');

// Clip the NLCD data to the region of interest
var nlcd_clipped = NLCD2021.clip(region);

// Get the geometry of the clipped region
var region2 = nlcd_clipped.geometry();

// Add the clipped NLCD data to the map
Map.addLayer(nlcd_clipped, {}, 'NLCD 2021');

// Load the NAIP data for the specified date and region
var NAIP = ee.ImageCollection('USDA/NAIP/DOQQ')
    .filterDate('2021-08-26', '2021-08-27')
    .filterBounds(region);

// Print the NAIP data
print(NAIP);

// Mosaic and clip the NAIP data to the region of interest
var naip_new = NAIP.mosaic().clip(region);

// Load the Sentinel-2 data for the specified date and region
var sentinel = ee.ImageCollection('COPERNICUS/S2_SR')
    .filterDate('2021-08-25', '2021-08-26')
    .filterBounds(region);

// Print the Sentinel-2 data
print(sentinel);

// Mosaic and clip the Sentinel-2 data to the region of interest
var sentinel_new = sentinel.mosaic().clip(region);

// Add the clipped Sentinel-2 data to the map
Map.addLayer(sentinel_new,
    {bands: ['B4', 'B3', 'B2'],
    min: 0,
    max: 3000,
    },
    'Sentinel-2 SR (scaled 10^4 times)');

// Get the numeric codes of the NLCD classes
var class_values = ee.List(
    nlcd_clipped.get('landcover_class_values'));

// Print the numeric codes of the NLCD classes
print('Numeric codes of NLCD classes', class_values);

// Get the color palette of the NLCD classes
var class_palette = ee.List(
    nlcd_clipped.get('landcover_class_palette'));

// Print the color palette of the NLCD classes
print('Palette of NLCD classes:', class_palette);

// Define the band names for the Sentinel-2 and NAIP data
var bands = ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B11', 'B12',];
var bands2 = ['R', 'G', 'B', 'N'];

// Sample the NLCD data within the region of interest
var points = nlcd_clipped.sample({
    region: region,
    scale: 30,
    numPixels: 9E4,
    seed: 0,
    geometries: true,
});

// Sample the Sentinel-2 and NAIP data at the sampled points
var sample = sentinel_new.select(bands).sampleRegions({
    collection: points,
    scale: 30,
});
var sample2 = naip_new.select(bands2).sampleRegions({
    collection: points,
    scale: 30,
});

// Randomly split the samples into training and validation sets
sample = sample.randomColumn();
var split = 0.7;
var training = sample.filter(ee.Filter.lt('random', split));
var validation = sample.filter(ee.Filter.gte('random', split));
sample2 = sample2.randomColumn();
var split2 = 0.7;
var training2 = sample2.filter(ee.Filter.lt('random', split));
var validation2 = sample2.filter(ee.Filter.gte('random', split));

// Train a random forest classifier on the training data
var classifier = ee.Classifier.smileRandomForest(10)
    .train({
    features: training,
    classProperty: 'landcover',
    inputProperties: bands
    });
var classifier2 = ee.Classifier.smileRandomForest(10)
    .train({
    features: training2,
    classProperty: 'landcover',
    inputProperties: bands2
    });

// Classify the Sentinel-2 and NAIP data using the trained classifiers
var result = sentinel_new.select(bands).classify(classifier)
    .set('landcover_class_values', class_values)
    .set('landcover_class_palette', class_palette)
    .select(['classification'], ['landcover']);
var result2 = naip_new.select(bands2).classify(classifier2)
    .set('landcover_class_values', class_values)
    .set('landcover_class_palette', class_palette)
    .select(['classification'], ['landcover']);

// Add the classified Sentinel-2 data to the map
Map.addLayer(result, {}, 'Classified Sentinel');

// Create a new UI map
var linkedMap = new ui.Map();

// Add the NAIP data and the classified NAIP data to the linked map
linkedMap.addLayer(naip_new, {}, 'NAIP');
linkedMap.addLayer(result2, {}, 'Classified NAIP');

// Link the root widget and the linked map
var linker = ui.Map.Linker([ui.root.widgets().get(0), linkedMap]);

// Create a split panel with the linked map and the root widget
var splitPanel = new ui.SplitPanel({
 firstPanel: linker.get(1),
 secondPanel: linker.get(0),
 orientation: 'horizontal',
 wipe: true,
 style: {stretch: 'both'}
});

// Reset the root widget with the split panel
ui.root.widgets().reset([splitPanel]);

// Get a confusion matrix representing resubstitution accuracy for the classifiers
var trainAccuracy = classifier.confusionMatrix();
var trainAccuracy2 = classifier2.confusionMatrix();

// Print the overall accuracy of the classifiers
print('Training overall accuracy: ', trainAccuracy.accuracy());
print('Training overall accuracy: ', trainAccuracy2.accuracy());