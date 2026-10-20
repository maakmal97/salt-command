/* engine/geo.mjs: THE DISTANCE BETWEEN TWO POINTS, ONE COPY (his answer of 20 Oct 2026).
 *
 * The Desk measures a delivery's distance for the fee it offers (master/salt_command.html, the great-circle distance times
 * RULES.delivery.roadFactor), and from 20 Oct 2026 Salt Admin says the same distance under Delivery cost on an order's Bill. Two
 * copies would drift, so this is the one: inlined into the master between markers by `node tools/engine.mjs --sync`, and carried
 * into the statements site as stmt/geo.js, byte for byte, by `node tools/geosite.mjs --sync`, each with a --check the gate runs.
 * The points never travel: the Desk and Salt Admin each measure in the browser, after the one unlock, from points they hold. */
const GEO_ENGINE=(function(){
/* the great-circle distance in km between {lat, lng} points, on the mean Earth radius */
function haversineKm(a,b){var r=function(x){return x*Math.PI/180;},dLa=r(b.lat-a.lat),dLo=r(b.lng-a.lng);
  var h=Math.pow(Math.sin(dLa/2),2)+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.pow(Math.sin(dLo/2),2);return 2*6371.0088*Math.asin(Math.min(1,Math.sqrt(h)));}
return {haversineKm:haversineKm};
})();
export default GEO_ENGINE;
