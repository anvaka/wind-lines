/* globals streamlines */
// The code below renders streamlines of a windmap.

// First, let's set up full screen scene
var canvas = document.createElement("canvas");
var ctx = canvas.getContext("2d");
var width = (canvas.width = window.innerWidth);
var height = (canvas.height = window.innerHeight);
ctx.fillStyle = "#0A1936";
ctx.fillRect(0, 0, width, height);
document.body.appendChild(canvas);

// Now download the coastline and draw it
request("ne_110m_coastline.geojson").then(drawCoastline);

function drawCoastline(data) {
  data = JSON.parse(data);
  ctx.lineJoin = ctx.lineCap = "round";
  ctx.strokeStyle = "#578";
  ctx.beginPath();
  for (var i = 0; i < data.features.length; i++) {
    var line = data.features[i].geometry.coordinates;
    for (var j = 0; j < line.length; j++) {
      ctx[j ? "lineTo" : "moveTo"](
        ((line[j][0] + 180) * canvas.width) / 360,
        ((-line[j][1] + 90) * canvas.height) / 180
      );
    }
  }
  ctx.stroke();

  loadWindMap("2019010300.png").then(drawField);
}

function drawField(result) {
  var uMax = 25.7396;
  var uMin = -20.9104;
  var vMax = 22.3119;
  var vMin = -26.0981;
  var maxVelocity = Math.sqrt(uMax * uMax + vMax * vMax);

  var workingSet = [];
  var animationQueue = [];
  var maxAnimations = 20,
    pointsPerAnimation = 42;

  var gradient = makeGradient([
    { stop: 0.0, r: 0x32, g: 0x88, b: 0xbd },
    { stop: 0.1, r: 0x66, g: 0xc2, b: 0xa5 },
    { stop: 0.2, r: 0xab, g: 0xdd, b: 0xa4 },
    { stop: 0.3, r: 0xe6, g: 0xf5, b: 0x98 },
    { stop: 0.4, r: 0xfe, g: 0xe0, b: 0x8b },
    { stop: 0.5, r: 0xfd, g: 0xae, b: 0x61 },
    { stop: 1.0, r: 0xf4, g: 0x6d, b: 0x43 }
    //{stop: 1.0, r: 0xd5, g: 0x3e, b: 0x4f}
  ]);

  var boundingBox = {
    left: 0,
    top: 0,
    width: result.width,
    height: result.height
  };

  requestAnimationFrame(frame);

  // Read more about this api here: https://github.com/anvaka/streamlines
  streamlines({
    dSep: 0.5,
    dTest: 0.25,
    boundingBox: boundingBox,
    vectorField: vectorField,
    timeStep: 0.09,
    stepsPerIteration: 4,
    onStreamlineAdded: onStreamlineAdded
  }).run();

  // This is the main function that extracts velocity vector from the wind texture.
  function vectorField(p) {
    // We will be using interpolation, as described by https://blog.mapbox.com/how-i-built-a-wind-map-with-webgl-b63022b5537f
    var lx = Math.floor(p.x);
    var ly = Math.floor(p.y);
    var ux = Math.ceil(p.x);
    var uy = Math.ceil(p.y);

    if (lx < 0) lx = ux;
    if (ux >= result.width) ux = lx;
    if (ly < 0) ly = uy;
    if (uy > result.height) uy = ly;
    if (outside(lx, ly) || outside(ux, uy)) return;

    var tl = getXY(lx, ly);
    var tr = getXY(lx + 1, ly);
    var bl = getXY(lx, ly + 1);
    var br = getXY(lx + 1, ly + 1);

    if (!tl || !tr || !bl || !br) return;

    // use interpolation to get better details in the mid points.
    var res = mix(mix(tl, tr, p.x - lx), mix(bl, br, p.x - lx), 1 - p.y + ly);
    return {
      // I don't really know why we need minus. This way it matches the original wind map by Vladimir Agafonkin
      x: -(res.x * (uMax - uMin) + uMin),
      y: res.y * (vMax - vMin) + vMin
    };
  }

  // Given vector field coordinates - read value from the wind texture.
  function getXY(x, y) {
    if (outside(x, y)) return;
    var idx = (x + y * result.width) * 4;
    return {
      x: result.pixels[idx] / 255,
      y: result.pixels[idx + 1] / 255
    };
  }

  // Checks if a point is outside of the visible area.
  function outside(x, y) {
    return x < 0 || x >= result.width || y < 0 || y >= result.height;
  }

  // Linear interpolation between two points
  function mix(a, b, ratio) {
    return {
      x: a.x * ratio + (1 - ratio) * b.x,
      y: a.y * ratio + (1 - ratio) * b.y
    };
  }

  function onStreamlineAdded(points) {
    // We do not want to plot all points at once - the result will look jagged. Instead - queue
    // the streamline in the animation queue, and let requestAnimationFrame handle it.
    animationQueue.push({ points, idx: 0 });
  }

  // This function slowly and steadily picks lines from animation queue, and animates their appearance.
  function frame() {
    requestAnimationFrame(frame);

    // We maintain two arrays - one is working array of the lines that are being animated, and the other
    // one is just an animation queue.
    for (var i = 0; i < workingSet.length; ++i) {
      var line = workingSet[i];
      var lineDone = animate(line);

      if (lineDone && i < workingSet.length) {
        // When line is completed we pop it out of the working array. We could have used splice()
        // But I feel like `pop()` should be faster (didn't test it, just a feel)
        // So, move the finished line to the end,
        var t = workingSet[workingSet.length - 1];
        workingSet[workingSet.length - 1] = line;
        workingSet[i] = t;
        workingSet.pop(); // and pop it.
      }
    }

    // If we have enough room in the working set, and enough animations in the queue, extend the working set.
    while (workingSet.length < maxAnimations && animationQueue.length > 0) {
      // Just a bit of randomness - make animation look slightly more organic.
      var line =
        Math.random() < 0.5 ? animationQueue.shift() : animationQueue.pop();
      workingSet.push(line);
    }
  }

  function animate(line) {
    var from = line.idx;
    var to =
      line.idx + Math.random() * pointsPerAnimation + pointsPerAnimation / 2;
    for (var i = from + 1; i < to; ++i) {
      if (i >= line.points.length) return true; // We are done.
      line.idx = i;
      drawSegment(line.points[i - 1], line.points[i]);
    }
  }

  // Draws a segment between two points.
  function drawSegment(a, b) {
    ctx.beginPath();
    // get color in the middle of the vector.
    ctx.strokeStyle = getColor((a.x + b.x) * 0.5, (a.y + b.y) * 0.5);
    a = transform(a);
    b = transform(b);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.closePath();
  }

  // Turns vector field point into canvas point.
  function transform(pt) {
    var tx = (pt.x - boundingBox.left) / boundingBox.width;
    var ty = (pt.y - boundingBox.top) / boundingBox.height;

    return { x: tx * width, y: ty * height };
  }

  function getColor(x, y) {
    var p = vectorField({ x, y });
    if (!p) return "rgba(0, 0, 0, 1.)";
    var gray = Math.sqrt(p.x * p.x + p.y * p.y) / maxVelocity;
    var c = gradient(gray);
    return (
      "rgba(" + c.r + ", " + c.g + "," + c.b + ", " + (0.2 + gray * 1.5) + ")"
    );
  }
}

/**
 * Creates a linear gradient function from array of stops.
 */
function makeGradient(stops) {
  return getColor;

  function getColor(t) {
    if (t <= 0) return stops[0];
    if (t >= 1) return stops[stops.length - 1];

    var from = stops[0];

    // the array of stops is small. No need to be fancy - plain iteration is good enough
    for (var i = 1; i < stops.length; ++i) {
      var to = stops[i];
      if (from.stop <= t && t < to.stop) {
        // how far are we between these two stops?
        var dist = (t - from.stop) / (to.stop - from.stop);
        return mix(from, to, dist);
      } else {
        // Keep looking
        from = to;
      }
    }

    throw new Error("This should not be possible!");
  }

  // linear interpolation between r, g, and b components of a color
  function mix(a, b, t) {
    return {
      r: Math.round(a.r * t + (1 - t) * b.r),
      g: Math.round(a.g * t + (1 - t) * b.g),
      b: Math.round(a.b * t + (1 - t) * b.b)
    };
  }
}

function loadWindMap(src) {
  // the windmap is encoded by https://github.com/mapbox/webgl-wind/blob/master/data/prepare.js
  // Only two channels are used (r and g).
  var image = new Image();
  image.crossOrigin = "";

  var resolve;

  return new Promise((r, reject) => {
    resolve = r;
    image.onload = imageLoaded;
    image.onerror = reject;

    image.src = src;
  });

  function imageLoaded() {
    var cnv = document.createElement("canvas");
    var width = (cnv.width = image.width),
      height = (cnv.height = image.height);
    var ctx = cnv.getContext("2d");
    ctx.drawImage(image, 0, 0, image.width, image.height);

    var pixels = ctx.getImageData(0, 0, width, height).data;
    resolve({
      width: width,
      height: height,
      pixels: pixels
    });
  }
}

function request(url, options) {
  if (!options) options = {};

  return new Promise(download);

  function download(resolve, reject) {
    var req = new XMLHttpRequest();

    if (typeof options.progress === "function") {
      req.addEventListener("progress", updateProgress, false);
    }

    req.addEventListener("load", transferComplete, false);
    req.addEventListener("error", transferFailed, false);
    req.addEventListener("abort", transferCanceled, false);

    req.open("GET", url);
    if (options.responseType) {
      req.responseType = options.responseType;
    }
    req.send(null);

    function updateProgress(e) {
      if (e.lengthComputable) {
        options.progress({
          loaded: e.loaded,
          total: e.total,
          percent: e.loaded / e.total
        });
      }
    }

    function transferComplete() {
      if (req.status !== 200) {
        reject(`Unexpected status code ${req.status} when calling ${url}`);
        return;
      }
      var response = req.response;

      if (options.responseType === "json" && typeof response === "string") {
        // IE
        response = JSON.parse(response);
      }

      resolve(response);
    }

    function transferFailed() {
      reject(`Failed to download ${url}`);
    }

    function transferCanceled() {
      reject(`Cancelled download of ${url}`);
    }
  }
}
