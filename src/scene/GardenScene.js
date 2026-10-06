/* ===================================================================
   GardenScene - renderer, camera, lighting and the day/night sky.
   Owns nothing gameplay-related; systems mutate it through update().
   =================================================================== */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { sampleSky } from './sky.js';
import { clamp, lerp, parseColor, rand } from '../utils.js';

const DEG = Math.PI / 180;

export class GardenScene {
  constructor(canvas, tier) {
    this.tier = tier;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: tier.aa,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.dpr));
    this.renderer.shadowMap.enabled = tier.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 600);

    /* camera orbits a point on the lawn; the player controller drives
       yaw/pitch/target, this class only places the eye              */
    this.camTarget = new THREE.Vector3(0, 1.2, 0);
    this.yaw = 0.08;
    this.pitch = 25 * DEG;
    this.dist = 18;
    this._cameraTarget = new THREE.Vector3();
    this._cameraReady = false;

    this._buildLights();
    this._buildSky();

    this.hour = 9;
    this.hourTarget = null;
    this.sky = sampleSky(this.hour);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /* ---------------------------------------------------------- lights */
  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3e7a44, 0.85);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.1);
    this.sun.castShadow = this.tier.shadows;
    const s = this.tier.shadowSize;
    this.sun.shadow.mapSize.set(s, s);
    this.sun.shadow.camera.near = 5;
    this.sun.shadow.camera.far = 140;
    this.sun.shadow.camera.left = -46;
    this.sun.shadow.camera.right = 46;
    this.sun.shadow.camera.top = 46;
    this.sun.shadow.camera.bottom = -46;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.fill = new THREE.DirectionalLight(0x9fb8ff, 0.28);
    this.fill.position.set(-30, 18, -24);
    this.scene.add(this.fill);
  }

  /* ------------------------------------------- sky dome + celestial */
  _buildSky() {
    /* gradient dome: top/bottom colours are driven per-frame from the
       ported 2D palette, so the 3D sky is never "just blue"          */
    this.skyUniforms = {
      top: { value: new THREE.Color('#3ba3e8') },
      bot: { value: new THREE.Color('#d6f1ff') }
    };
    const domeGeo = new THREE.SphereGeometry(320, 32, 18);
    const domeMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 bot;
        varying vec3 vPos;
        void main() {
          float h = clamp(normalize(vPos).y * 1.6 + 0.28, 0.0, 1.0);
          gl_FragColor = vec4(mix(bot, top, pow(h, 0.75)), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    this.dome = new THREE.Mesh(domeGeo, domeMat);
    this.dome.frustumCulled = false;
    this.scene.add(this.dome);

    /* stars - single Points, opacity driven by the palette           */
    const n = this.tier.stars;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = rand(Math.PI * 2), e = rand(0.06, 1.4);
      const r = 300;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.6, sizeAttenuation: false,
      transparent: true, opacity: 0, depthWrite: false, fog: false
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    /* sun & moon share one arc, sprite discs with soft glow          */
    const disc = (inner, outer) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const c = cv.getContext('2d');
      const g = c.createRadialGradient(64, 64, 8, 64, 64, 64);
      g.addColorStop(0, inner);
      g.addColorStop(0.35, inner);
      g.addColorStop(1, outer);
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const mkSprite = (tex, size) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, fog: false
      }));
      sp.scale.set(size, size, 1);
      this.scene.add(sp);
      return sp;
    };
    this.sunDisc = mkSprite(disc('#fffdf0', 'rgba(255,244,190,0)'), 44);
    this.moonDisc = mkSprite(disc('#f4f6ff', 'rgba(200,214,255,0)'), 30);

    /* a subtle rainbow sprite, shown after rain clears (classic reward) */
    this.rainbow = this._buildRainbow();

    /* fog ties the far lawn into the sky colour instead of a hard edge */
    this.scene.fog = new THREE.Fog(0xd6f1ff, 42, 155);
  }

  _buildRainbow() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    const bands = ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#b197fc'];
    const R = 118, W = 6;
    for (let i = 0; i < bands.length; i++) {
      c.beginPath();
      c.arc(128, 128, R - i * W, Math.PI, Math.PI * 2);
      c.strokeStyle = bands[i];
      c.lineWidth = W;
      c.lineCap = 'round';
      c.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0
    }));
    sp.scale.set(48, 48, 1);
    sp.center.set(0.5, 0.5);
    this.scene.add(sp);
    return sp;
  }

  /* intensity: 0..1, drives sprite opacity + a slow scale breathing */
  setRainbow(intensity, playerPos) {
    const t = Math.max(0, Math.min(1, intensity));
    this.rainbow.material.opacity = t * 0.65;
    this.rainbow.visible = t > 0.02;
    if (t > 0.02 && playerPos) {
      const breathe = 1 + Math.sin(performance.now() * 0.0003) * 0.02;
      this.rainbow.scale.set(48 * breathe, 48 * breathe, 1);
      this.rainbow.position.set(playerPos.x, playerPos.y + 4, playerPos.z);
    }
  }

  /* -------------------------------------------------- day/night step */
  /* hourTarget mirrors classic toggleDayNight(): a tween, not a jump  */
  updateClock(dt) {
    if (this.hourTarget !== null) {
      const diff = this.hourTarget - this.hour;
      if (Math.abs(diff) < 0.05) {
        this.hour = this.hourTarget;
        this.hourTarget = null;
      } else {
        this.hour += diff * Math.min(1, dt * 1.6);
      }
    } else {
      this.hour = (this.hour + dt * (24 / CONFIG.dayLength)) % 24;
    }
    this.sky = sampleSky(this.hour);
    this._applySky();
  }

  _applySky() {
    const sky = this.sky;
    this.skyUniforms.top.value.setStyle(sky.top);
    this.skyUniforms.bot.value.setStyle(sky.bot);
    this.starMat.opacity = sky.stars;
    this.stars.visible = sky.stars > 0.02;
    this.scene.fog.color.setStyle(sky.bot);

    /* sun arc: rise ~6h, set ~18.5h (matches classic bodyPos)        */
    const h = this.hour;
    const day = h >= 6 && h <= 18.5;
    const t = day ? (h - 6) / 12.5
      : (h < 6 ? h + 24 - 18.5 : h - 18.5) / 11.5;
    const a = clamp(t, 0, 1) * Math.PI;
    const cx = Math.cos(a) * 150;
    const cy = Math.sin(a) * 120 + 8;
    const body = day ? this.sunDisc : this.moonDisc;
    this.sunDisc.visible = day;
    this.moonDisc.visible = !day;
    body.position.set(this.camTarget.x - cx, cy, this.camTarget.z - 170);

    /* key light follows the visible body, colour comes from palette  */
    const c = parseColor(sky.light);
    this.sun.color.setRGB(c.r / 255, c.g / 255, c.b / 255);
    this.sun.intensity = day ? lerp(1.4, 2.3, Math.sin(a)) : 0.12;
    const inv = day ? 1 : -1;
    this.sun.position.set(
      this.camTarget.x + inv * cx * 0.4,
      Math.max(14, cy),
      this.camTarget.z + 60
    );
    this.sun.target.position.set(this.camTarget.x, 0, this.camTarget.z);

    const hemiC = parseColor(sky.bot);
    const hemiG = parseColor(sky.gLight);
    this.hemi.color.setRGB(hemiC.r / 255, hemiC.g / 255, hemiC.b / 255);
    this.hemi.groundColor.setRGB(hemiG.r / 255, hemiG.g / 255, hemiG.b / 255);
    this.hemi.intensity = 0.85;
    this.fill.intensity = day ? 0.28 : 0.24;
  }

  toggleDayNight() {
    this.hourTarget = this.hour > 6.5 && this.hour < 18 ? 22 : 9.5;
    return this.hourTarget;
  }

  /* --------------------------------------------------- camera placement */
  setCameraTarget(x, y, z) { this.camTarget.set(x, y, z); }

  applyCamera(dt = 1 / 60) {
    if (!this._cameraReady) { this._cameraTarget.copy(this.camTarget); this._cameraReady = true; }
    this._cameraTarget.lerp(this.camTarget, 1 - Math.exp(-dt * 9));
    const target = this._cameraTarget;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.camera.position.set(
      target.x + Math.sin(this.yaw) * cp * this.dist,
      target.y + sp * this.dist,
      target.z + Math.cos(this.yaw) * cp * this.dist
    );
    /* never let the eye sink through the lawn */
    this.camera.position.y = Math.max(this.camera.position.y, 0.8);
    this.camera.lookAt(target);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    this.scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of list) if (material) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    for (const resource of [...geometries, ...materials, ...textures]) resource.dispose();
    this.renderer.dispose();
  }

  /* quality tiers for mobile vs desktop */
  static tierFor() {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const small = Math.min(screen.width, screen.height) < 820;
    const mobile = (coarse && small) || new URLSearchParams(location.search).get('quality') === 'low';
    return mobile
      ? { aa: false, dpr: 1.25, shadows: false, shadowSize: 512, grass: 1400, stars: 260, petals: 90, pollen: 40, rain: 260 }
      : { aa: true, dpr: 1.5, shadows: true, shadowSize: 2048, grass: 5200, stars: 620, petals: 220, pollen: 140, rain: 700 };
  }
}

