// MITHRA solar glyph, rendered in 3D (ray-marched signed distance fields).
// Shared by the website and the desktop splash.
//
//   MithraGlyph.start(canvas, { transparent, getProgress, onFail })
//
// getProgress() returns 0..1: 0 = medallion at rest, ~0.5 = camera passes
// through the pupil, >0.5 = gold ring tunnel, 1 = calm resting tunnel.
(function (root) {
  "use strict";
  const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res; uniform float u_time, u_p, u_alpha; uniform vec2 u_mouse;
#define PI 3.14159265
#define GOLD vec3(0.92,0.70,0.36)

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float sdVesica(vec2 p,float r,float d){ p=abs(p); float b=sqrt(r*r-d*d);
  return ((p.y-b)*d>p.x*b) ? length(p-vec2(0.0,b)) : length(p-vec2(-d,0.0))-r; }

// ---- medallion scene: returns (distance, material) ----
// materials: 1 gold, 2 bronze plate, 3 iris, 4 pupil
vec2 glyph(vec3 p){
  vec2 res = vec2(1e5, 0.0);
  // raised ring
  float ring = length(vec2(length(p.xy)-0.56, p.z)) - 0.038;
  res = ring < res.x ? vec2(ring,1.0) : res;
  // 12 tapered rays, alternating long and short
  float s = 2.0*PI/12.0;
  float a = atan(p.y,p.x);
  float idx = floor((a + s*0.5)/s);
  float aa = mod(a + s*0.5, s) - s*0.5;
  float r = length(p.xy);
  vec2 q = vec2(r*cos(aa), r*sin(aa));
  float a1 = mod(idx,2.0) < 0.5 ? 0.98 : 0.86;
  float x = clamp(q.x, 0.70, a1);
  float th = mix(0.030, 0.008, (x-0.70)/(a1-0.70));
  float ray = length(vec3(q.x-x, q.y, p.z)) - th;
  res = ray < res.x ? vec2(ray,1.0) : res;
  // engraved eye outline (extruded, rounded)
  float e2 = abs(sdVesica(p.yx, 0.567, 0.364)) - 0.016;
  float eye = length(vec2(max(e2,0.0), p.z - 0.004)) - 0.014;
  res = eye < res.x ? vec2(eye,1.0) : res;
  // domed iris with a pupil hole
  float iris = length(p - vec3(0.0,0.0,-0.03)) - 0.105;
  iris = max(iris, -p.z - 0.02);
  float hole = length(p.xy) - 0.036;
  iris = max(iris, -hole);
  res = iris < res.x ? vec2(iris, 3.0) : res;
  // bronze back plate with a bevelled rim
  float plate = max(length(p.xy) - 0.535, abs(p.z + 0.055) - 0.016) - 0.004;
  plate = max(plate, -max(hole, abs(p.z+0.055)-0.1));
  res = plate < res.x ? vec2(plate, 2.0) : res;
  return res;
}

// ---- tunnel scene: endless gold rings ----
vec2 tunnel(vec3 p){
  float cell = 0.9;
  float id = floor(p.z / cell);
  vec3 q = p; q.z = mod(p.z, cell) - cell*0.5;
  q.xy *= rot(id*0.6 + u_time*0.15);
  float ring = length(vec2(length(q.xy)-1.15, q.z)) - 0.03;
  // short spokes on each ring, like the glyph's rays
  float s = 2.0*PI/12.0; float a = atan(q.y,q.x);
  float aa = mod(a + s*0.5, s) - s*0.5; float r = length(q.xy);
  vec2 k = vec2(r*cos(aa), r*sin(aa));
  float spoke = length(vec3(k.x - clamp(k.x, 1.15, 1.35), k.y, q.z)) - 0.012;
  return vec2(min(ring, spoke), 1.0);
}

float tunnelMix;
vec2 map(vec3 p){ return tunnelMix > 0.5 ? tunnel(p) : glyph(p); }

vec3 normalAt(vec3 p){
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x, map(p+e.yxy).x-map(p-e.yxy).x, map(p+e.yyx).x-map(p-e.yyx).x));
}

// studio environment for metal reflections: warm floor, bright softbox band
vec3 env(vec3 d){
  float band = smoothstep(0.55, 0.9, d.y) * 1.6 + smoothstep(0.2, 0.0, abs(d.x - 0.6)) * 0.6;
  vec3 c = mix(vec3(0.05,0.035,0.02), vec3(0.32,0.22,0.10), smoothstep(-0.6, 0.4, d.y));
  return c + vec3(1.0,0.9,0.7) * band;
}

vec3 shade(vec3 p, vec3 rd, float m){
  vec3 n = normalAt(p);
  vec3 l1 = normalize(vec3(0.6 + 0.5*sin(u_time*0.35), 0.8, 0.9));
  vec3 l2 = normalize(vec3(-0.8, -0.3, 0.6));
  float dif = max(dot(n,l1),0.0)*0.9 + max(dot(n,l2),0.0)*0.25;
  vec3 h = normalize(l1 - rd);
  float spec = pow(max(dot(n,h),0.0), 64.0);
  float fres = pow(1.0 - max(dot(n,-rd),0.0), 4.0);
  vec3 refl = env(reflect(rd, n));
  if (m < 1.5) {               // polished gold
    return GOLD*(0.12 + dif*0.55) + refl*GOLD*0.85 + spec*vec3(1.0,0.92,0.75)*1.4 + fres*GOLD*0.5;
  } else if (m < 2.5) {        // dark bronze plate with fine engraved rings
    float groove = 0.75 + 0.25*smoothstep(0.3, 0.7, abs(fract(length(p.xy)*38.0) - 0.5)*2.0);
    vec3 bronze = vec3(0.16,0.11,0.06) * groove;
    return bronze*(0.25 + dif*0.8) + refl*vec3(0.25,0.17,0.08)*0.35 + spec*vec3(0.9,0.7,0.4)*0.35;
  } else if (m < 3.5) {        // iris: amber metal with radial striations
    float ang = atan(p.y,p.x);
    float stri = 0.7 + 0.3*sin(ang*48.0 + hash(vec2(floor(ang*48.0/6.283)))*6.0);
    vec3 amber = mix(vec3(0.55,0.32,0.10), vec3(1.0,0.82,0.45), stri) * (0.35 + dif*0.75);
    return amber + refl*GOLD*0.45 + spec*vec3(1.0,0.95,0.8)*1.2;
  }
  return vec3(0.0);
}

vec4 march(vec3 ro, vec3 rd, float maxd){
  float t = 0.0;
  for (int i = 0; i < 64; i++) {
    vec2 h = glyph(ro + rd*t);
    if (h.x < 0.0008) return vec4(ro + rd*t, h.y);
    t += h.x * 0.9;
    if (t > maxd) break;
  }
  return vec4(0.0, 0.0, 0.0, -1.0);
}
// the tunnel covers every pixel, so it gets a cheaper march
vec4 marchTunnel(vec3 ro, vec3 rd, float maxd){
  float t = 0.0;
  for (int i = 0; i < 44; i++) {
    vec2 h = tunnel(ro + rd*t);
    if (h.x < 0.002) return vec4(ro + rd*t, h.y);
    t += h.x;
    if (t > maxd) break;
  }
  return vec4(0.0, 0.0, 0.0, -1.0);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*u_res) / u_res.y;
  float p = u_p, t = u_time;
  float fit = max(1.0, (u_res.y/u_res.x) * 0.8);
  vec3 col = vec3(0.0); float alpha = 0.0;

  // background: deep black-brown with drifting gold dust
  vec3 bg = mix(vec3(0.03,0.025,0.02), vec3(0.075,0.055,0.03), smoothstep(1.2, 0.0, length(uv)));
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    vec2 g = uv * (5.0 + fl*6.0) + vec2(t*0.02*(fl+1.0), -t*0.03) + fl*13.0;
    vec2 id = floor(g), f = fract(g) - 0.5;
    float h = hash(id);
    float star = smoothstep(0.06, 0.0, length(f - (vec2(hash(id+2.3), hash(id+5.1)) - 0.5)*0.7)) * step(0.86, h);
    bg += vec3(0.95,0.75,0.4) * star * (0.65 + 0.35*sin(t*1.5 + h*30.0)) * 0.6;
  }

  float dive = smoothstep(0.0, 0.55, p);
  tunnelMix = step(0.5, p);
  if (tunnelMix < 0.5) {
    // camera dollies from rest toward the pupil, tilting gently
    float rest = 1.0 - smoothstep(0.0, 0.25, p);
    float wide = max(1.0, (u_res.x/u_res.y) / 1.6);     // short, wide frames: pull back
    float camZ = mix(3.35*fit*wide, 0.06, pow(dive, 1.6));
    // the website lifts the medallion above its wordmark; the splash centers it
    vec3 ro = vec3(0.0, -0.5*rest*fit*u_alpha, camZ);
    vec3 rd = normalize(vec3(uv, -1.45));
    // turn the medallion: idle sway + mouse + a quarter twist during the dive
    float yaw = 0.32*sin(t*0.45) * (1.0 - dive) + u_mouse.x*0.5 + dive*0.9;
    float pitch = 0.18*cos(t*0.37) * (1.0 - dive) - u_mouse.y*0.35;
    ro.xz *= rot(yaw); rd.xz *= rot(yaw);
    ro.yz *= rot(pitch); rd.yz *= rot(pitch);
    vec4 hit = march(ro, rd, camZ + 2.0);
    if (hit.w > 0.0) {
      col = shade(hit.xyz, rd, hit.w); alpha = 1.0;
    }
    // warm halo behind the medallion
    float halo = exp(-2.2*length(uv - vec2(0.0, 0.5*rest*fit/3.1*1.45*u_alpha))) * 0.35 * (1.0 - dive);
    if (u_alpha < 0.5) halo = 0.0;   // transparent splash: only the medallion, no box-shaped haze
    bg += vec3(0.85,0.55,0.2) * halo;
    col = mix(bg, col, alpha);
    alpha = max(alpha, clamp(halo*1.6, 0.0, 0.9));
    // flash of gold light as the camera passes the pupil
    col += vec3(1.0,0.8,0.45) * smoothstep(0.44, 0.5, p) * 0.35;
  } else {
    // through the pupil: fly down a tunnel of gold rings that slows to rest
    float calm = smoothstep(0.8, 1.0, p);
    float zt = -(p - 0.5) * 14.0 - t * mix(0.9, 0.12, calm);
    vec3 ro = vec3(0.0, 0.0, zt);
    vec3 rd = normalize(vec3(uv, -1.2));
    rd.xy *= rot(t*0.05);
    vec4 hit = marchTunnel(ro, rd, 10.0);
    col = bg;
    if (hit.w > 0.0) {
      float dist = length(hit.xyz - ro);
      float fog = exp(-0.22 * dist);
      // distant rings are mostly fog: skip full shading there
      vec3 c = fog > 0.25 ? shade(hit.xyz, rd, hit.w) : GOLD * 0.35;
      col = mix(bg, c, fog);
    }
    col *= mix(1.0, 0.55, calm);
    col += vec3(1.0,0.8,0.45) * (1.0 - smoothstep(0.5, 0.535, p)) * 0.35;
    alpha = 1.0;
  }

  col = pow(min(col, vec3(1.0)), vec3(0.92));
  col *= 1.0 - 0.35*dot(uv, uv);
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;   // dither: no banding in dark gradients
  if (u_alpha > 0.5) gl_FragColor = vec4(col, 1.0);
  else gl_FragColor = vec4(col * alpha, alpha);   // transparent splash, premultiplied
}`;

  function start(canvas, opts) {
    opts = opts || {};
    const transparent = !!opts.transparent;
    // software renderers (no GPU) get the static logo instead of a slideshow
    const gl = canvas.getContext("webgl", { antialias: false, alpha: transparent, premultipliedAlpha: true,
      powerPreference: "default", failIfMajorPerformanceCaveat: !opts.allowSoftware });
    let dead = false;
    const fail = () => { dead = true; opts.onFail && opts.onFail(); };
    if (!gl) { fail(); return null; }
    canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); fail(); });
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}"));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { console.error(e); fail(); return null; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(prog, n);
    const uRes = U("u_res"), uTime = U("u_time"), uP = U("u_p"), uMouse = U("u_mouse"), uAlpha = U("u_alpha");
    gl.uniform1f(uAlpha, transparent ? 0 : 1);
    gl.clearColor(0, 0, 0, 0);

    let mx = 0, my = 0;
    if (!opts.noPointer) addEventListener("pointermove", e => { mx = e.clientX / innerWidth - 0.5; my = 0.5 - e.clientY / innerHeight; }, { passive: true });

    // ray marching is costly: cap resolution, drop further if frames run slow
    let scale = opts.maxScale || Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.0 : 1.25);
    const minScale = 0.4;
    let lastW = 0, lastH = 0;
    function resize(force) {
      const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
      if (!force && w === lastW && Math.abs(h - lastH) < 160) return;
      lastW = w; lastH = h;
      canvas.width = Math.max(1, Math.floor(w * scale));
      canvas.height = Math.max(1, Math.floor(h * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    }
    let timer = 0;
    addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(() => resize(false), 150); });
    resize(true);

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let prev = t0, avg = 16, slow = 0, eased = 0, lastDrawn = -1;
    function frame(now) {
      if (dead) return;
      const dt = now - prev; prev = now;
      // smoothed frame time; ignore gaps from background tabs (> 1s)
      if (dt < 1000) avg += (dt - avg) * 0.1;
      if (avg > 28) slow++; else slow = 0;
      if (scale > minScale && slow > 12) { scale = Math.max(minScale, scale * 0.75); slow = 0; avg = 16; resize(true); }
      const target = opts.getProgress ? opts.getProgress() : 0;
      eased += (target - eased) * (reduce ? 1 : 0.08);
      // reduced motion: draw a still frame and only redraw when something changes
      if (reduce && lastDrawn === canvas.width * 7 + canvas.height) {
        if (!opts.stopWhen || !opts.stopWhen(now)) requestAnimationFrame(frame);
        return;
      }
      lastDrawn = canvas.width * 7 + canvas.height;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, reduce ? 2.0 : (now - t0) / 1000);
      gl.uniform1f(uP, reduce ? 0 : eased);
      gl.uniform2f(uMouse, mx, my);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!opts.stopWhen || !opts.stopWhen(now)) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { stop: () => { dead = true; } };
  }

  root.MithraGlyph = { start };
})(window);
