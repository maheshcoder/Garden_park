import * as THREE from 'three';
import { windUniforms } from './utils.js';

/* Injects time-based sway into a MeshStandardMaterial's vertex stage.
   Works for plain and instanced meshes alike: displacement scales
   with local height (transformed.y), so trunks stay rooted while
   canopies, blossoms and blades flutter in the shared wind.          */
export function swayMaterial(params, { stiffness = 0.14, gust = 1.0 } = {}) {
  const mat = new THREE.MeshStandardMaterial(params);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    shader.uniforms.uStiff = { value: stiffness };
    shader.uniforms.uGust = { value: gust };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uWind; uniform float uStiff; uniform float uGust;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 iOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #else
            vec3 iOrigin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #endif
          float phase = uTime * 1.7 + iOrigin.x * 0.35 + iOrigin.z * 0.27;
          float h = max(transformed.y, 0.0);
          float sway = (sin(phase) + 0.45 * sin(phase * 2.3 + 1.7)) * uWind * uGust;
          transformed.x += sway * uStiff * h;
          transformed.z += 0.6 * sway * uStiff * h * 0.5;
        }`);
  };
  mat.customProgramCacheKey = () => `sway|${stiffness}|${gust}`;
  return mat;
}
