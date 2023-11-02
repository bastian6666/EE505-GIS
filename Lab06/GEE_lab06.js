// Load an image.
var image = ee.Image('LANDSAT/LT05/C01/T1_SR/LT05_012031_20110801');

// Define the visualization parameters.
var vizParams = {
  bands: ['B4', 'B3', 'B2'],
  min: 0,
  max: 8000,
  gamma: [0.95, 1.1, 1]
};

// Center the map and display the image.
Map.setCenter(-71.0589, 42.3601, 10); // San Francisco Bay
//Map.addLayer(image, vizParams, 'false color composite');

var ndvi = image.select('B4')
    .subtract(
      image.select('B3')
    )
    .divide(
      image.select('B4')
    .add(
      image.select('B3')
    )
    );
    
//Map.addLayer(ndvi,
//{min: -1, max: 1, palette: ['red', 'green']},
//'NDVI image');


var dense_veg = ndvi.gt(0.65);
//Map.addLayer(dense_veg,
//{min: 0, max: 1},
//'dense_veg');

var MA_towns = ee.FeatureCollection(
'projects/ee505-fall-2023/assets/SSB/MA_towns_subset');

Map.addLayer(MA_towns, null, 'MA Towns');

var areaImg = ee.Image.pixelArea(); // in m2
areaImg = areaImg.divide(1E4); // convert to hectare
areaImg = areaImg.updateMask(dense_veg); // mask operation


var towns_dv_area = areaImg.reduceRegions({
collection: MA_towns,
reducer: ee.Reducer.sum(),
scale: 30
});


print(towns_dv_area);


Export.image.toDrive({
image: dense_veg,
description: 'dense_veg_image',
folder: 'EE505_GEE',
scale: 30,
region: dense_veg.geometry()
});

//To export zonal statistics results:

Export.table.toDrive({
collection: towns_dv_area,
description:'town_dense_veg_stats',
folder: 'EE505_GEE',
fileFormat: 'SHP'
});