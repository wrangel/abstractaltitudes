// src/frontend/utils/webglSupport.js
//
// Module-scope memoization: the probe canvas is created ONCE per page load
// and the result cached. Calling hasWebGL() or getMaxCubeMapSize() from a
// React component body or effect is therefore free after the first call.
//
// Note: this used to call WEBGL_lose_context on the probe context immediately
// after creating it, to free the slot before Marzipano's real context. That
// was removed — it's unverified whether an immediate lose+recreate cycle is
// reliable across devices, and letting the throwaway canvas/context be
// garbage-collected normally is the standard, low-risk approach.

let _webglSupported = null;

export function hasWebGL() {
  if (_webglSupported !== null) return _webglSupported;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
      console.warn("hasWebGL: getContext('webgl') returned no context");
      _webglSupported = false;
      return false;
    }
    _webglSupported = true;
  } catch (err) {
    console.warn("hasWebGL: probe threw", err);
    _webglSupported = false;
  }
  return _webglSupported;
}

let _maxCubeMapSize = null;

export function getMaxCubeMapSize() {
  if (_maxCubeMapSize !== null) return _maxCubeMapSize;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
      _maxCubeMapSize = 2048;
      return 2048;
    }
    _maxCubeMapSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
  } catch (err) {
    console.warn("getMaxCubeMapSize: probe threw", err);
    _maxCubeMapSize = 2048;
  }
  return _maxCubeMapSize;
}
