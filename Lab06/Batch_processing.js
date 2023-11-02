var startDate = "2006-01-01"; // define the start date
var endDate = "2012-12-31"; // define the end date
var filterPoint = ee.Geometry.Point(-71.0589,42.3601); // Boston

var imageColl_LT5 = ee.ImageCollection("LANDSAT/LT05/C01/T1_SR")
.filterBounds(filterPoint)
.filterDate(startDate,endDate)
.filter(ee.Filter.lt('CLOUD_COVER', 5));

var calc_area_img = function(image) {
  var ndvi = image.select('B4').subtract(image.select('B3'))
.divide(
image.select('B4').add(image.select('B3')
));
var dense_veg = ndvi.gt(0.65);
var areaImg = ee.Image.pixelArea();
areaImg = areaImg.divide(1E4);
areaImg = areaImg.updateMask(dense_veg);
return areaImg;
};

var areaImageColl = imageColl_LT5.map(calc_area_img);


print(areaImageColl)


var areaImageStacked = areaImageColl.toBands();

var areaImageStackeBandNames = areaImageStacked.bandNames();
// this function split the band name by '_'
// extract the third element (counting from 0)
// add 'A' to the beginning of date string
// because shapefile table header needs to start with a letter
var sliceBandNames = function(bandname){
var date = ee.String(bandname).split('_').get(2);
return ee.String('A').cat(date);
};
// apply the above function over the list of band names
var areaImageStackeNewBandNames =
areaImageStackeBandNames.map(sliceBandNames);
// rename the image with new band names
var areaImageStackedNewName =
areaImageStacked.rename(areaImageStackeNewBandNames);

var MA_towns = ee.FeatureCollection(
'projects/ee505-fall-2023/assets/SSB/MA_towns_subset');
var zonalStats = areaImageStackedNewName.reduceRegions({collection: MA_towns,
reducer: ee.Reducer.sum(),
scale: 30,
});

Export.table.toDrive({
collection: zonalStats,
description:'town_dense_veg_stats_imageColl',
folder: 'EE505_GEE',
fileFormat: 'SHP'
});