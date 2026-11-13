/**
 * KOFFEY bokeh background: soft out-of-focus dots drifting slowly through a beam of light (WebGL, instanced quads).
 * Look and numbers follow the "Bokeh" generative background studied on the reference site
 * (size 5, count 2, speed 50, alpha 35, seed 44, path 9/55 and 18/84, offset 99, light 41 / 14 / 72); the code below is our own.
 * Usage: <div class="bokeh" data-bg="#2d231d" data-c1="#d3b999" data-c2="#f8f4ed" data-light="#d3b999"></div> as the first child of a section.
 * The noise function is classic Perlin noise by Stefan Gustavson (MIT licence, https://github.com/ashima/webgl-noise).
 */
(function () {
  var MAX_PARTICLES = 100000;
  var DEFAULTS = { size: 5, count: 2, speed: 50, alpha: 35, seed: 44, complexityY: 9, complexityZ: 18, amplitudeY: 55, amplitudeZ: 84, offset: 99, lightAngle: 41, lightIntensity: 14, lightX: 72 };
  var FOV = 40 * Math.PI / 180, NEAR = 1, FAR = 10000, CAM_Z = 100;

  // Linear remap, same helper the reference uses for every slider
  function map(v, a1, b1, a2, b2) { return (v - a1) * (b2 - a2) / (b1 - a1) + a2; }

  var NOISE = [
    "vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }",
    "vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }",
    "vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }",
    "vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }",
    "vec3 fade(vec3 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }",
    "float cnoise(vec3 P) {",
    "  vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0); Pi0 = mod289(Pi0); Pi1 = mod289(Pi1);",
    "  vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0);",
    "  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x); vec4 iy = vec4(Pi0.yy, Pi1.yy);",
    "  vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz;",
    "  vec4 ixy = permute(permute(ix) + iy); vec4 ixy0 = permute(ixy + iz0); vec4 ixy1 = permute(ixy + iz1);",
    "  vec4 gx0 = ixy0 * (1.0 / 7.0); vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;",
    "  gx0 = fract(gx0); vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0); vec4 sz0 = step(gz0, vec4(0.0));",
    "  gx0 -= sz0 * (step(0.0, gx0) - 0.5); gy0 -= sz0 * (step(0.0, gy0) - 0.5);",
    "  vec4 gx1 = ixy1 * (1.0 / 7.0); vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;",
    "  gx1 = fract(gx1); vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1); vec4 sz1 = step(gz1, vec4(0.0));",
    "  gx1 -= sz1 * (step(0.0, gx1) - 0.5); gy1 -= sz1 * (step(0.0, gy1) - 0.5);",
    "  vec3 g000 = vec3(gx0.x, gy0.x, gz0.x); vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);",
    "  vec3 g010 = vec3(gx0.z, gy0.z, gz0.z); vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);",
    "  vec3 g001 = vec3(gx1.x, gy1.x, gz1.x); vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);",
    "  vec3 g011 = vec3(gx1.z, gy1.z, gz1.z); vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);",
    "  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));",
    "  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;",
    "  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));",
    "  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;",
    "  float n000 = dot(g000, Pf0); float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));",
    "  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z)); float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));",
    "  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z)); float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));",
    "  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz)); float n111 = dot(g111, Pf1);",
    "  vec3 f = fade(Pf0);",
    "  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), f.z);",
    "  vec2 n_yz = mix(n_z.xy, n_z.zw, f.y);",
    "  return 2.2 * mix(n_yz.x, n_yz.y, f.x);",
    "}"
  ].join("\n");

  var HEAD = "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n";

  // Dots: each instance slides along x over its own period, wobbles in y/z with noise, and blurs with depth
  var PARTICLE_VERT = HEAD + NOISE + [
    "attribute vec3 aPosition; attribute vec2 aUv;",
    "attribute vec3 aOffset; attribute vec4 aParticle; attribute vec2 aDelayDuration;",
    "uniform float uTime, uSize, uSeed, uOffset, uFocal, uAspect;",
    "uniform vec3 uStart, uEnd; uniform vec4 uPath;",
    "varying vec2 vUv; varying vec3 vPosition; varying vec4 vParticle;",
    "void main() {",
    "  float p = mod(uTime + aDelayDuration.x, aDelayDuration.y) / aDelayDuration.y;",
    "  vec3 position = mix(uStart, uEnd, p);",
    "  float n1 = cnoise(vec3(p, uSeed, 0.0) * uPath.x);",
    "  float n2 = cnoise(vec3(p, uSeed, 0.0) * uPath.z);",
    "  position.y += n1 * uPath.y; position.z += n2 * uPath.w;",
    "  float n3 = n2 * 0.5 + 0.3;",
    "  position += aOffset * n3 * uOffset;",
    "  float n = cnoise(position * 0.1);",
    "  position.z += n * 4.0;",
    "  position += aPosition * uSize * aParticle.x * n;",
    "  vUv = aUv; vPosition = position; vParticle = aParticle;",
    "  float zv = position.z - " + CAM_Z.toFixed(1) + ";",
    "  float nearFar = " + (FAR - NEAR).toFixed(1) + ";",
    "  gl_Position = vec4(position.x * uFocal / uAspect, position.y * uFocal,",
    "    -(" + (FAR + NEAR).toFixed(1) + " / nearFar) * zv - 2.0 * " + (FAR * NEAR).toFixed(1) + " / nearFar, -zv);",
    "}"
  ].join("\n");

  var PARTICLE_FRAG = HEAD + [
    "uniform vec3 uColor1, uColor2; uniform float uAlpha;",
    "varying vec2 vUv; varying vec3 vPosition; varying vec4 vParticle;",
    "float circle(vec2 uv, vec2 blur, float r) {",
    "  vec2 dist = uv - vec2(0.5);",
    "  return 1.0 - smoothstep(r - (r * blur.x), r + (r * blur.y), dot(dist, dist) * 4.0);",
    "}",
    "void main() {",
    "  float depth = abs((vPosition.z + 160.0) / 320.0); depth *= depth;",
    "  vec2 blur = vec2(vParticle.y + 0.5 * depth, vParticle.z + 0.5 * depth);",
    "  float a = circle(vUv, blur, 0.5);",
    "  vec3 color = mix(uColor1, uColor2, vParticle.w);",
    "  gl_FragColor = vec4(color * a * vParticle.w * uAlpha, a * uAlpha);",
    "}"
  ].join("\n");

  // Light: one soft, grainy shaft of light across the whole canvas
  var LIGHT_VERT = "attribute vec2 aPosition; varying vec2 vUv; void main() { vUv = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }";
  var LIGHT_FRAG = HEAD + NOISE + [
    "uniform float uTime, uIntensity, uAngle, uPosition; uniform vec3 uColor;",
    "varying vec2 vUv;",
    "float random(vec2 c) { return fract(sin(dot(c.xy, vec2(12.9898, 78.233))) * 43758.5453); }",
    "vec2 rotate(vec2 uv, float a) { float ca = cos(a); float sa = sin(a); return vec2(uv.x * ca + uv.y * sa, -uv.x * sa + uv.y * ca); }",
    "void main() {",
    "  vec2 coord = rotate(vUv - vec2(0.5), uAngle) + vec2(0.5);",
    "  float n = cnoise(vec3(coord * vec2(8.0, 1.0), uTime * 0.25)) * 0.5 + 0.5;",
    "  n *= vUv.y * vUv.y;",
    "  float c = mix(0.0, 1.0, smoothstep(0.0, uPosition, vUv.x));",
    "  c = mix(c, 0.0, smoothstep(uPosition, 1.0, vUv.x));",
    "  n *= c * uIntensity;",
    "  n += mix(-0.5 / 255.0, 0.5 / 255.0, random(vUv));",
    "  gl_FragColor = vec4(uColor, n);",
    "}"
  ].join("\n");

  function rgb(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) { h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2); }
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }

  function program(gl, vs, fs) {
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) { return null; }
    var p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  }

  function uniforms(gl, p, names) {
    var u = {};
    for (var i = 0; i < names.length; i++) { u[names[i]] = gl.getUniformLocation(p, names[i]); }
    return u;
  }

  function rand(a, b) { return a + (b - a) * Math.random(); }

  function Bokeh(node) {
    var d = node.dataset, cfg = {}, k;
    for (k in DEFAULTS) { cfg[k] = d[k] !== undefined ? parseFloat(d[k]) : DEFAULTS[k]; }
    this.cfg = cfg; this.node = node;
    this.bg = rgb(d.bg || "#000000"); this.c1 = rgb(d.c1 || "#ffffff"); this.c2 = rgb(d.c2 || "#ffffff"); this.c3 = rgb(d.light || "#ffffff");
    this.time = 0; this.raf = 0; this.last = 0; this.visible = false;
    this.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!this.setup()) { return; }
    node.classList.add("is-gl");
    this.resize();
    var self = this;
    if ("ResizeObserver" in window) { new ResizeObserver(function () { self.resize(); }).observe(node); }
    new IntersectionObserver(function (entries) {
      self.visible = entries[0].isIntersecting;
      if (self.visible && !self.reduce) { self.last = 0; self.loop(performance.now()); }
    }, { rootMargin: "10% 0px" }).observe(node);
  }

  Bokeh.prototype.setup = function () {
    var canvas = document.createElement("canvas");
    var gl = canvas.getContext("webgl", { antialias: true, alpha: false, powerPreference: "low-power" });
    var inst = gl && gl.getExtension("ANGLE_instanced_arrays");
    if (!gl || !inst) { return false; }
    this.pp = program(gl, PARTICLE_VERT, PARTICLE_FRAG);
    this.lp = program(gl, LIGHT_VERT, LIGHT_FRAG);
    if (!this.pp || !this.lp) { return false; }
    this.gl = gl; this.inst = inst; this.canvas = canvas;
    this.pu = uniforms(gl, this.pp, ["uTime", "uSize", "uSeed", "uOffset", "uFocal", "uAspect", "uStart", "uEnd", "uPath", "uColor1", "uColor2", "uAlpha"]);
    this.lu = uniforms(gl, this.lp, ["uTime", "uIntensity", "uAngle", "uPosition", "uColor"]);

    // One unit quad, plus per-particle random attributes (offset, delay/duration, size/blur/colour mix)
    var quad = new Float32Array([-0.5, -0.5, 0, 0, 0, 0.5, -0.5, 0, 1, 0, -0.5, 0.5, 0, 0, 1, 0.5, 0.5, 0, 1, 1]);
    this.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    this.count = Math.max(0, Math.floor(map(this.cfg.count, 0, 100, 0, MAX_PARTICLES)));
    var n = this.count, off = new Float32Array(n * 3), dd = new Float32Array(n * 2), pa = new Float32Array(n * 4), i;
    for (i = 0; i < n; i++) {
      off[i * 3] = rand(-1, 1); off[i * 3 + 1] = rand(-1, 1); off[i * 3 + 2] = rand(-1, 1);
      dd[i * 2] = rand(0, 1); dd[i * 2 + 1] = rand(0.5, 1);
      pa[i * 4] = rand(0.1, 1); pa[i * 4 + 1] = rand(0.25, 0.75); pa[i * 4 + 2] = rand(0.25, 0.75); pa[i * 4 + 3] = rand(0, 1);
    }
    this.bufOff = this.makeBuffer(off); this.bufDd = this.makeBuffer(dd); this.bufPa = this.makeBuffer(pa);
    this.lightQuad = this.makeBuffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));

    var c = this.cfg;
    gl.useProgram(this.pp);
    gl.uniform1f(this.pu.uSize, map(c.size, 1, 100, 1, 32));
    gl.uniform1f(this.pu.uAlpha, map(c.alpha, 1, 100, 0.01, 1));
    gl.uniform1f(this.pu.uSeed, c.seed);
    gl.uniform4f(this.pu.uPath, map(c.complexityY, 0, 100, 0, 6), map(c.amplitudeY, 0, 100, 0, 100), map(c.complexityZ, 0, 100, 0, 6), map(c.amplitudeZ, 0, 100, 0, 100));
    gl.uniform1f(this.pu.uOffset, map(c.offset, 0, 100, 1, 60));
    gl.uniform1f(this.pu.uFocal, 1 / Math.tan(FOV / 2));
    gl.uniform3fv(this.pu.uColor1, this.c1); gl.uniform3fv(this.pu.uColor2, this.c2);
    gl.useProgram(this.lp);
    gl.uniform1f(this.lu.uIntensity, map(c.lightIntensity, 0, 100, 0, 1));
    gl.uniform1f(this.lu.uAngle, map(c.lightAngle, 0, 100, -0.3 * Math.PI, 0.3 * Math.PI));
    gl.uniform1f(this.lu.uPosition, map(c.lightX, 0, 100, 0, 1));
    gl.uniform3fv(this.lu.uColor, this.c3);
    this.speed = map(c.speed, -100, 100, -0.01, 0.01); // world time units per second
    this.node.appendChild(canvas);
    return true;
  };

  Bokeh.prototype.makeBuffer = function (data) {
    var b = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, b);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
    return b;
  };

  Bokeh.prototype.resize = function () {
    var dpr = Math.min(1.5, window.devicePixelRatio || 1);
    var w = Math.max(2, Math.round(this.node.clientWidth * dpr)), h = Math.max(2, Math.round(this.node.clientHeight * dpr));
    this.canvas.width = w; this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    var aspect = w / h, visH = 2 * CAM_Z * Math.tan(FOV / 2), visW = visH * aspect, a = Math.max(visW, visH);
    this.gl.useProgram(this.pp);
    this.gl.uniform1f(this.pu.uAspect, aspect);
    this.gl.uniform3f(this.pu.uStart, -0.75 * a, 0, 0);
    this.gl.uniform3f(this.pu.uEnd, 0.75 * a, 0, 0);
    this.draw();
  };

  Bokeh.prototype.attrib = function (prog, name, buf, size, stride, offset, divisor) {
    var gl = this.gl, loc = gl.getAttribLocation(prog, name);
    if (loc < 0) { return; }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
    this.inst.vertexAttribDivisorANGLE(loc, divisor);
  };

  Bokeh.prototype.draw = function () {
    var gl = this.gl;
    gl.clearColor(this.bg[0], this.bg[1], this.bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive glow, like light

    gl.useProgram(this.pp);
    gl.uniform1f(this.pu.uTime, this.time);
    this.attrib(this.pp, "aPosition", this.quad, 3, 20, 0, 0);
    this.attrib(this.pp, "aUv", this.quad, 2, 20, 12, 0);
    this.attrib(this.pp, "aOffset", this.bufOff, 3, 0, 0, 1);
    this.attrib(this.pp, "aDelayDuration", this.bufDd, 2, 0, 0, 1);
    this.attrib(this.pp, "aParticle", this.bufPa, 4, 0, 0, 1);
    if (this.count > 0) { this.inst.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, this.count); }
    this.inst.vertexAttribDivisorANGLE(gl.getAttribLocation(this.pp, "aOffset"), 0);
    this.inst.vertexAttribDivisorANGLE(gl.getAttribLocation(this.pp, "aDelayDuration"), 0);
    this.inst.vertexAttribDivisorANGLE(gl.getAttribLocation(this.pp, "aParticle"), 0);

    gl.useProgram(this.lp);
    gl.uniform1f(this.lu.uTime, this.time);
    this.attrib(this.lp, "aPosition", this.lightQuad, 2, 0, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  Bokeh.prototype.loop = function (now) {
    var self = this;
    cancelAnimationFrame(this.raf);
    if (!this.visible || document.hidden) { return; }
    var dt = this.last ? Math.min((now - this.last) / 1000, 0.1) : 0;
    this.last = now;
    this.time += dt * this.speed;
    this.draw();
    this.raf = requestAnimationFrame(function (t) { self.loop(t); });
  };

  var nodes = document.querySelectorAll(".bokeh");
  for (var i = 0; i < nodes.length; i++) { new Bokeh(nodes[i]); }
})();
