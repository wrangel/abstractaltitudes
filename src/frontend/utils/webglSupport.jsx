// src/frontend/utils/webglSupport.js
//
// Module-scope memoization: the probe canvas is created ONCE per page load,
// the result cached, and the GL context explicitly released immediately after
// reading so the browser slot is freed before Marzipano needs it.
// Calling hasWebGL() or getMaxCubeMapSize() from a React component body or
// effect is therefore free — no new canvas is created on subsequent calls.

let _webglSupported = null;

export function hasWebGL() {
  if (_webglSupported !== null) return _webglSupported;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
      _webglSupported = false;
      return false;
    }
    // Release the context immediately so the browser can reclaim the slot
    // before the real Marzipano viewer is created.
    const ext = gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
    _webglSupported = true;
  } catch {
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
    const ext = gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
  } catch {
    _maxCubeMapSize = 2048;
  }
  return _maxCubeMapSize;
}
