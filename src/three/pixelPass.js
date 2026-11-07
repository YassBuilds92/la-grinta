import * as THREE from 'three';

// Rendu pixel art : la scène est rendue dans une cible basse déf, puis agrandie au plus proche voisin
// avec contour sombre d'1 px (détecté en profondeur), palette réduite tramée Bayer et ombres décalées en teinte.

const gradCache = new Map();
function toonGradient(steps = 3) {
  if (gradCache.has(steps)) return gradCache.get(steps);
  const data = new Uint8Array(steps * 4);
  const tones = steps === 3 ? [165, 215, 255] : Array.from({ length: steps }, (_, i) => Math.round(((i + 1) / steps) * 255));
  tones.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const t = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  gradCache.set(steps, t);
  return t;
}

const toonCache = new WeakMap();
// Remplace les matériaux standard par des matériaux "toon" à 3 tons (cache par matériau)
export function toonify(root) {
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noToon) return;
    const swap = (m) => {
      if (!m || m.isMeshToonMaterial || m.isShaderMaterial || m.isMeshBasicMaterial) return m;
      if (toonCache.has(m)) return toonCache.get(m);
      const t = new THREE.MeshToonMaterial({
        color: m.color,
        map: m.map || null,
        emissive: m.emissive || new THREE.Color(0),
        emissiveIntensity: m.emissiveIntensity ?? 1,
        transparent: m.transparent,
        opacity: m.opacity,
        side: m.side,
        depthWrite: m.depthWrite,
        polygonOffset: m.polygonOffset,
        polygonOffsetFactor: m.polygonOffsetFactor,
        gradientMap: toonGradient(3),
      });
      // reflets métal : un ton plus clair
      if (m.metalness > 0.5) t.color = m.color.clone().offsetHSL(0.01, 0.05, 0.08);
      toonCache.set(m, t);
      return t;
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
}

export class PixelPass {
  constructor(renderer, { targetHeight = 360, pixelCss = 1, near = 0.5, far = 60 } = {}) {
    this.pixelCss = pixelCss;
    this.r = renderer;
    this.targetHeight = targetHeight;
    this.rt = new THREE.WebGLRenderTarget(4, 4, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture: new THREE.DepthTexture(4, 4),
      samples: 0,
    });
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tC: { value: this.rt.texture },
        tD: { value: this.rt.depthTexture },
        uRes: { value: new THREE.Vector2(4, 4) },
        uScale: { value: 2 },
        uNear: { value: near },
        uFar: { value: far },
        uBg0: { value: new THREE.Vector3(0.95,0.86,0.72) },
        uBg1: { value: new THREE.Vector3(0.80,0.92,1.0) },
        uBg2: { value: new THREE.Vector3(0.66,0.85,1.0) },
        uInk: { value: new THREE.Vector3(0.16,0.10,0.18) },
      },
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D tC, tD; uniform vec2 uRes; uniform float uScale, uNear, uFar;
        uniform vec3 uBg0, uBg1, uBg2, uInk;
        float lz(float z){ float n = z * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - n * (uFar - uNear)); }
        float bayer(vec2 p){
          p = mod(p, 4.); int i = int(p.x) + int(p.y) * 4;
          float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
          for (int k = 0; k < 16; k++) { if (k == i) return (m[k] + .5) / 16.; } return .5; }
        void main(){
          vec2 px = floor(gl_FragCoord.xy / uScale);
          vec2 uv = (px + .5) / uRes; vec2 o = 1. / uRes;
          float th = bayer(px);
          float dr = texture2D(tD, uv).r;
          vec3 col;
          bool isBg = dr >= 0.99999;
          // couleur de la scène : tone mapping + passage en sRGB, puis traitement pixel art
          gl_FragColor = vec4(texture2D(tC, uv).rgb, 1.);


          col = gl_FragColor.rgb;
          if (isBg) {
            float g = uv.y * 2.2 + th - .5;
            col = g < .6 ? uBg0 : (g < 1.5 ? uBg1 : uBg2);
          } else {
            float L = 28.;
            col = floor(col * L + th * .9) / L;
            float lum = dot(col, vec3(.299, .587, .114));
            col = mix(col * vec3(.9, .88, 1.06), col, smoothstep(.1, .4, lum));
            col = mix(col, col * vec3(1.05, 1.0, .9), smoothstep(.75, 1., lum) * .5);
          }
          float d0 = lz(dr);
          float m = 0.;
          vec2 dirs[4]; dirs[0] = vec2(o.x, 0.); dirs[1] = vec2(-o.x, 0.); dirs[2] = vec2(0., o.y); dirs[3] = vec2(0., -o.y);
          for (int k = 0; k < 4; k++) {
            float dn = lz(texture2D(tD, uv + dirs[k]).r);
            if (dn < d0 - max(.12, d0 * .035)) m = 1.;
          }
          if (m > .5) col = mix(col * .45, uInk, .5);
          gl_FragColor = vec4(col, 1.);
        }`,
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
    });
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    q.frustumCulled = false;
    this.scene.add(q);
    this.w = this.h = 4;
  }

  setSize(cssW, cssH) {
    const d = this.r.getPixelRatio();
    const W = Math.round(cssW * d), H = Math.round(cssH * d);
    // 1 pixel du rendu = 1 pixel CSS : net et lisible même de loin, le style vient du toon et des contours
    const sc = Math.max(1, Math.round(d * this.pixelCss));
    this.w = Math.ceil(W / sc);
    this.h = Math.ceil(H / sc);
    this.rt.setSize(this.w, this.h);
    this.mat.uniforms.uRes.value.set(this.w, this.h);
    this.mat.uniforms.uScale.value = sc;
    return { w: this.w, h: this.h, scale: sc };
  }

  render(scene, camera) {
    const r = this.r;
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);
  }
}
