import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

// Screen-space volumetric light shafts ("god rays") from the projected light.
function godRaysShader(samples) {
  return {
    uniforms: {
      tDiffuse: { value: null }, uLight: { value: new THREE.Vector2(0.5, 0.5) },
      uStrength: { value: 0.8 }, uDecay: { value: 0.955 }, uDensity: { value: 0.55 }, uThreshold: { value: 0.85 },
      uTime: { value: 0 },
    },
    vertexShader: VS,
    fragmentShader: /* glsl */ `
      #define SAMPLES ${samples}
      uniform sampler2D tDiffuse; uniform vec2 uLight; uniform float uStrength, uDecay, uDensity, uThreshold, uTime;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime)*43758.5453); }
      vec3 safe(vec3 c){
        if (any(isnan(c)) || any(isinf(c))) return vec3(0.0);
        return clamp(c, 0.0, 48.0);
      }
      void main(){
        // Some GPUs (notably Direct3D via ANGLE) can produce NaN/Inf from
        // additive HDR overdraw; one bad pixel would be smeared over the whole
        // screen by bloom, so every value is sanitised here first.
        vec3 base = safe(texture2D(tDiffuse, vUv).rgb);
        if (uStrength < 0.001) { gl_FragColor = vec4(base, 1.0); return; }
        vec2 delta = (vUv - uLight) * uDensity / float(SAMPLES);
        vec2 p = vUv - delta * hash(vUv*1024.0);
        vec3 acc = vec3(0.0); float w = 1.0;
        for (int i = 0; i < SAMPLES; i++) {
          p -= delta;
          vec3 s = safe(texture2D(tDiffuse, clamp(p, 0.001, 0.999)).rgb);
          s = max(s - uThreshold, 0.0);
          acc += s * w;
          w *= uDecay;
        }
        acc /= float(SAMPLES);
        gl_FragColor = vec4(safe(base + acc * uStrength), 1.0);
      }`,
  };
}

// Final grade: peripheral depth blur, chromatic dispersion, lens ghosts, transition zoom, vignette, grain.
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uCA: { value: 0.6 }, uDof: { value: 0.4 }, uTrans: { value: 0 }, uFlash: { value: 0 },
    uVignette: { value: 0.75 }, uGrain: { value: 0.035 }, uLight: { value: new THREE.Vector2(0.5, 0.5) },
    uFlare: { value: 0.5 }, uTint: { value: new THREE.Color(1, 1, 1) }, uSat: { value: 1 },
  },
  vertexShader: VS,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uCA, uDof, uTrans, uFlash, uVignette, uGrain, uFlare, uSat;
    uniform vec2 uRes, uLight; uniform vec3 uTint;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r = length(c * vec2(uRes.x/uRes.y, 1.0));
      float blur = uDof * smoothstep(0.28, 0.85, r) * 0.014 + uTrans * 0.07;
      float ca = (uCA * 0.0045 + uTrans * 0.02) * smoothstep(0.0, 0.9, r);
      vec3 col = vec3(0.0);
      const int T = 9;
      float j = hash(vUv*uRes + fract(uTime)) ;
      for (int i = 0; i < T; i++) {
        float k = (float(i) + j) / float(T);
        vec2 o = -c * blur * k;
        col.r += texture2D(tDiffuse, vUv + o + c*ca).r;
        col.g += texture2D(tDiffuse, vUv + o).g;
        col.b += texture2D(tDiffuse, vUv + o - c*ca).b;
      }
      col /= float(T);

      // Lens flare ghosts along the axis through the screen centre
      if (uFlare > 0.001) {
        vec2 axis = 0.5 - uLight;
        vec3 ghost = vec3(0.0);
        for (int g = 1; g <= 4; g++) {
          vec2 gp = vUv + axis * (float(g) * 0.42);
          vec2 uvg = 1.0 - gp;
          vec3 s = max(texture2D(tDiffuse, clamp(uvg, 0.0, 1.0)).rgb - 1.2, 0.0);
          float wgt = 1.0 - smoothstep(0.0, 0.7, length(uvg - 0.5));
          ghost += s * wgt * (g == 2 ? vec3(0.5, 0.7, 1.0) : (g == 3 ? vec3(1.0, 0.6, 0.8) : vec3(0.8, 0.9, 1.0)));
        }
        vec2 lp = (vUv - uLight) * vec2(uRes.x/uRes.y, 1.0);
        float halo = exp(-pow((length(lp) - 0.32)*22.0, 2.0)) * 0.05;
        col += (ghost * 0.06 + halo * uTint) * uFlare;
      }

      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = max(mix(vec3(lum), col, uSat), 0.0);
      col *= mix(1.0, 1.0 - smoothstep(0.35, 1.05, r), uVignette);
      col += uFlash * vec3(1.0, 0.97, 0.92);
      col += (hash(vUv*uRes + uTime*61.0) - 0.5) * uGrain * (0.4 + 0.6*clamp(dot(col, vec3(0.33)), 0.0, 1.0));
      if (any(isnan(col))) col = vec3(0.0);
      gl_FragColor = vec4(clamp(col, 0.0, 64.0), 1.0);
    }`,
};

// Frame accumulation motion blur (ping-pong history buffer).
class FeedbackPass extends Pass {
  constructor() {
    super();
    this.amount = 0;
    this.hist = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tNew: { value: null }, tOld: { value: null }, uAmt: { value: 0 } },
      vertexShader: VS,
      fragmentShader: `uniform sampler2D tNew, tOld; uniform float uAmt; varying vec2 vUv;
        void main(){ vec3 n = texture2D(tNew, vUv).rgb; vec3 o = texture2D(tOld, vUv).rgb;
          if (any(isnan(o)) || any(isinf(o))) o = vec3(0.0); if (any(isnan(n)) || any(isinf(n))) n = vec3(0.0);
          gl_FragColor = vec4(mix(n, max(n, o*0.97), uAmt), 1.0); }`,
    });
    this.copy = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null } }, vertexShader: VS,
      fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }`,
    });
    this.quad = new FullScreenQuad(this.mat);
    this.cquad = new FullScreenQuad(this.copy);
    this.reset = true;
  }
  setSize(w, h) { this.hist.setSize(w, h); this.reset = true; }
  render(renderer, writeBuffer, readBuffer) {
    const amt = this.reset ? 0 : this.amount;
    this.mat.uniforms.tNew.value = readBuffer.texture;
    this.mat.uniforms.tOld.value = this.hist.texture;
    this.mat.uniforms.uAmt.value = amt;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
    // store result as next frame's history
    this.copy.uniforms.tDiffuse.value = (this.renderToScreen ? readBuffer : writeBuffer).texture;
    renderer.setRenderTarget(this.hist);
    if (this.renderToScreen) { this.quad.render(renderer); } else { this.cquad.render(renderer); }
    this.reset = false;
  }
  dispose() { this.hist.dispose(); this.mat.dispose(); this.copy.dispose(); this.quad.dispose(); this.cquad.dispose(); }
}

export class PostFX {
  constructor(renderer, scene, camera, { samples, raySamples, bloomScale }) {
    this.renderer = renderer;
    this.bloomScale = bloomScale;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.rays = new ShaderPass(godRaysShader(raySamples));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x * bloomScale, size.y * bloomScale), 1.0, 0.5, 0.55);
    this.feedback = new FeedbackPass();
    this.final = new ShaderPass(FinalShader);
    this.output = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.rays);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.feedback);
    this.composer.addPass(this.final);
    this.composer.addPass(this.output);
  }
  setSize(w, h, dpr) {
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.bloom.setSize(w * dpr * this.bloomScale, h * dpr * this.bloomScale);
    this.final.uniforms.uRes.value.set(w * dpr, h * dpr);
  }
  render(dt) { this.composer.render(dt); }
  dispose() {
    this.composer.dispose();
    this.bloom.dispose();
    this.feedback.dispose();
    this.rays.material.dispose();
    this.final.material.dispose();
  }
}
