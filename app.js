const canvas = document.getElementById("waterCanvas");
const gl = canvas.getContext("webgl", {
alpha: true,
antialias: true,
premultipliedAlpha: false
});
const background = document.getElementById("background");
const waterAmount = document.getElementById("waterAmount");
const waterValue = document.getElementById("waterValue");
const backgroundInput = document.getElementById("backgroundInput");
const resetButton = document.getElementById("resetButton");
if (!gl) {
alert("このブラウザではWebGLを利用できません。");
throw new Error("WebGL unavailable");
}
/* =====================================================
Vertex Shader
===================================================== */
const vertexShaderSource = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
v_uv = a_position * 0.5 + 0.5;
gl_Position = vec4(a_position, 0.0, 1.0);
}
`;
/* =====================================================
Fragment Shader
===================================================== */
const fragmentShaderSource = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_background;
uniform float u_time;
uniform float u_water;
uniform vec2 u_resolution;
uniform vec2 u_impact;
uniform float u_impactStrength;
uniform vec2 u_backgroundResolution;
/* =====================================================
Hash
===================================================== */
float hash(vec2 p) {
return fract(
sin(
dot(
p,
vec2(127.1, 311.7)
)
) * 43758.5453123
);
}
/* =====================================================
Noise
===================================================== */
float noise(vec2 p) {
vec2 i = floor(p);
vec2 f = fract(p);
f = f * f * (3.0 - 2.0 * f);
float a = hash(i);
float b = hash(i + vec2(1.0, 0.0));
float c = hash(i + vec2(0.0, 1.0));
float d = hash(i + vec2(1.0, 1.0));
return mix(
mix(a, b, f.x),
mix(c, d, f.x),
f.y
);
}
/* =====================================================
FBM
===================================================== */
float fbm(vec2 p) {
float value = 0.0;
float amplitude = 0.5;
for (int i = 0; i < 5; i++) {
value += noise(p) * amplitude;

p *= 2.0;
amplitude *= 0.5;
}
return value;
}
/* =====================================================
スライム変形範囲
===================================================== */
float slimeDeform(vec2 uv) {
/*
画面の縦横比を補正して
タップ範囲を正円にする。
*/
vec2 aspect = vec2(
u_resolution.x / u_resolution.y,
1.0
);
vec2 p = (uv - u_impact) * aspect;
float dist = length(p);
/*
スライダーは「サイズ」だけ変更。
小さくしても
押す強さ自体は弱くならない。
*/
float radius =
0.025 +
u_water * 0.50;
/*
スライムらしい少し不規則な輪郭。
*/
float n = fbm(
p * 12.0 +
vec2(
u_time * 0.35,
-u_time * 0.22
)
);
float edge =
radius +
(n - 0.5) * 0.025;
/*
押した範囲。
*/
float deform = smoothstep(
edge + 0.055,
edge - 0.045,
dist
);
/*
中心も少し強くする。
*/
float inner = smoothstep(
radius * 0.15,
radius * 0.9,
dist
);
return deform *
(
0.58 +
0.42 * inner
) *
u_impactStrength;
}
/* =====================================================
背景画像を変形
===================================================== */
vec2 deformBackground(
vec2 uv,
float deform
) {
vec2 center = u_impact;
vec2 direction =
uv - center;
float distance =
length(direction);
/*
押した場所を
レンズのように押し込む。
*/
float lens =
deform *
(
1.0 -
smoothstep(
0.0,
0.12,
distance
)
);
/*
表面の細かい揺らぎ。
*/
float wave = fbm(
uv * 35.0 +
vec2(
u_time * 0.2,
u_time * 0.13
)
);
vec2 distortion = vec2(
wave - 0.5,
fbm(
  uv * 41.0 -
  vec2(
    u_time * 0.15,
    u_time * 0.08
  )
) - 0.5
);
/*
押し込み。
*/
uv +=
direction *
lens *
0.65;
/*
ネチネチした微細な揺れ。
*/
uv +=
distortion *
deform *
0.045;
/*
中心付近を少しだけ拡大。
*/
uv =
center +
(
uv - center
) *
(
1.0 -
deform * 0.10
);
return uv;
}
/* =====================================================
Main
===================================================== */
void main() {
/*
まず画面座標で変形する。
これによってタップ範囲が正円になる。
*/
vec2 uv = v_uv;
/*
スライム変形量。
*/
float deform =
slimeDeform(uv);
/*
背景画像を変形。
*/
vec2 deformedUV =
deformBackground(
uv,
deform
);
/*
画像の縦横比。
*/
float screenRatio =
u_resolution.x /
u_resolution.y;
float imageRatio =
u_backgroundResolution.x /
u_backgroundResolution.y;
/*
contain方式。
画像全体を表示し、
余った部分は透明にする。
*/
vec2 imageUV =
deformedUV;
float inside = 1.0;
if (screenRatio > imageRatio) {
/*
  画面の方が横長。
  左右に余白ができる。
*/

float scale =
  screenRatio /
  imageRatio;

imageUV.x =
  (
    deformedUV.x -
    0.5
  ) *
  scale +
  0.5;


if (
  imageUV.x < 0.0 ||
  imageUV.x > 1.0
) {
  inside = 0.0;
}
} else {
/*
  画面の方が縦長。
  上下に余白ができる。
*/

float scale =
  imageRatio /
  screenRatio;

imageUV.y =
  (
    deformedUV.y -
    0.5
  ) *
  scale +
  0.5;


if (
  imageUV.y < 0.0 ||
  imageUV.y > 1.0
) {
  inside = 0.0;
}
}
/*
画像の外側は透明。
下にある白い背景を表示する。
*/
if (inside < 0.5) {
gl_FragColor =
  vec4(
    0.0,
    0.0,
    0.0,
    0.0
  );

return;
}
/*
背景画像。
*/
vec4 color =
texture2D(
u_background,
imageUV
);
/*
水滴などは描画しない。
背景画像だけ表示。
*/
gl_FragColor =
vec4(
color.rgb,
1.0
);
}
`;
/* =====================================================
Shader作成
===================================================== */
function createShader(type, source) {
const shader =
gl.createShader(type);
gl.shaderSource(
shader,
source
);
gl.compileShader(shader);
if (
!gl.getShaderParameter(
shader,
gl.COMPILE_STATUS
)
) {
console.error(
  gl.getShaderInfoLog(shader)
);

throw new Error(
  "Shader compilation failed"
);
}
return shader;
}
const vertexShader =
createShader(
gl.VERTEX_SHADER,
vertexShaderSource
);
const fragmentShader =
createShader(
gl.FRAGMENT_SHADER,
fragmentShaderSource
);
/* =====================================================
Program
===================================================== */
const program =
gl.createProgram();
gl.attachShader(
program,
vertexShader
);
gl.attachShader(
program,
fragmentShader
);
gl.linkProgram(program);
if (
!gl.getProgramParameter(
program,
gl.LINK_STATUS
)
) {
console.error(
gl.getProgramInfoLog(program)
);
throw new Error(
"Program linking failed"
);
}
gl.useProgram(program);
/* =====================================================
Quad
===================================================== */
const buffer =
gl.createBuffer();
gl.bindBuffer(
gl.ARRAY_BUFFER,
buffer
);
gl.bufferData(
gl.ARRAY_BUFFER,
new Float32Array([
-1, -1,
1, -1,
-1, 1,
-1,  1,
 1, -1,
 1,  1
]),
gl.STATIC_DRAW
);
const positionLocation =
gl.getAttribLocation(
program,
"a_position"
);
gl.enableVertexAttribArray(
positionLocation
);
gl.vertexAttribPointer(
positionLocation,
2,
gl.FLOAT,
false,
0,
0
);
/* =====================================================
Uniform
===================================================== */
const timeLocation =
gl.getUniformLocation(
program,
"u_time"
);
const waterLocation =
gl.getUniformLocation(
program,
"u_water"
);
const resolutionLocation =
gl.getUniformLocation(
program,
"u_resolution"
);
const impactLocation =
gl.getUniformLocation(
program,
"u_impact"
);
const strengthLocation =
gl.getUniformLocation(
program,
"u_impactStrength"
);
const backgroundLocation =
gl.getUniformLocation(
program,
"u_background"
);
const backgroundResolutionLocation =
gl.getUniformLocation(
program,
"u_backgroundResolution"
);
/* =====================================================
背景テクスチャ
===================================================== */
const texture =
gl.createTexture();
gl.bindTexture(
gl.TEXTURE_2D,
texture
);
gl.texParameteri(
gl.TEXTURE_2D,
gl.TEXTURE_WRAP_S,
gl.CLAMP_TO_EDGE
);
gl.texParameteri(
gl.TEXTURE_2D,
gl.TEXTURE_WRAP_T,
gl.CLAMP_TO_EDGE
);
gl.texParameteri(
gl.TEXTURE_2D,
gl.TEXTURE_MIN_FILTER,
gl.LINEAR
);
gl.texParameteri(
gl.TEXTURE_2D,
gl.TEXTURE_MAG_FILTER,
gl.LINEAR
);
/* =====================================================
画像をGPUへ送る
===================================================== */
function uploadBackground() {
if (
!background.complete ||
!background.naturalWidth
) {
return;
}
gl.bindTexture(
gl.TEXTURE_2D,
texture
);
gl.pixelStorei(
gl.UNPACK_FLIP_Y_WEBGL,
true
);
gl.texImage2D(
gl.TEXTURE_2D,
0,
gl.RGBA,
gl.RGBA,
gl.UNSIGNED_BYTE,
background
);
}
background.addEventListener(
"load",
uploadBackground
);
uploadBackground();
/* =====================================================
Canvasサイズ
===================================================== */
function resize() {
const rect =
canvas.getBoundingClientRect();
const ratio =
Math.min(
window.devicePixelRatio || 1,
2
);
canvas.width =
Math.floor(
rect.width * ratio
);
canvas.height =
Math.floor(
rect.height * ratio
);
gl.viewport(
0,
0,
canvas.width,
canvas.height
);
}
window.addEventListener(
"resize",
resize
);
resize();
/* =====================================================
スライダー
===================================================== */
waterValue.textContent =
waterAmount.value + "%";
waterAmount.addEventListener(
"input",
() => {
waterValue.textContent =
  waterAmount.value + "%";
}
);
/* =====================================================
接触位置
===================================================== */
let impactX = 0.5;
let impactY = 0.5;
let impactStrength = 0;
let isDragging = false;
/* =====================================================
音
===================================================== */
let audioContext = null;
function initAudio() {
if (!audioContext) {
audioContext =
  new (
    window.AudioContext ||
    window.webkitAudioContext
  )();
}
if (
audioContext.state ===
"suspended"
) {
audioContext.resume();
}
}
/* =====================================================
スライム音
===================================================== */
function playSlimeSquish() {
if (!audioContext) {
return;
}
const now =
audioContext.currentTime;
/*
柔らかいノイズ。
*/
const buffer =
audioContext.createBuffer(
1,
audioContext.sampleRate * 0.18,
audioContext.sampleRate
);
const data =
buffer.getChannelData(0);
for (
let i = 0;
i < data.length;
i++
) {
const t =
  i / data.length;


data[i] =
  (
    Math.random() * 2 - 1
  ) *
  Math.pow(
    1 - t,
    1.7
  );
}
const noise =
audioContext.createBufferSource();
noise.buffer = buffer;
const filter =
audioContext.createBiquadFilter();
filter.type =
"lowpass";
filter.frequency.setValueAtTime(
500,
now
);
filter.frequency.exponentialRampToValueAtTime(
90,
now + 0.18
);
const noiseGain =
audioContext.createGain();
noiseGain.gain.setValueAtTime(
0.001,
now
);
noiseGain.gain.exponentialRampToValueAtTime(
0.16,
now + 0.02
);
noiseGain.gain.exponentialRampToValueAtTime(
0.001,
now + 0.18
);
noise
.connect(filter)
.connect(noiseGain)
.connect(
audioContext.destination
);
noise.start(now);
noise.stop(now + 0.18);
/*
低い「むにっ」という音。
*/
const oscillator =
audioContext.createOscillator();
const oscillatorGain =
audioContext.createGain();
oscillator.type =
"sine";
oscillator.frequency.setValueAtTime(
120,
now
);
oscillator.frequency.exponentialRampToValueAtTime(
48,
now + 0.20
);
oscillatorGain.gain.setValueAtTime(
0.001,
now
);
oscillatorGain.gain.exponentialRampToValueAtTime(
0.13,
now + 0.02
);
oscillatorGain.gain.exponentialRampToValueAtTime(
0.001,
now + 0.20
);
oscillator
.connect(oscillatorGain)
.connect(
audioContext.destination
);
oscillator.start(now);
oscillator.stop(now + 0.20);
}
/* =====================================================
音の連続再生防止
===================================================== */
let lastSoundTime = 0;
function playTouchSound() {
if (!audioContext) {
return;
}
const now =
performance.now();
if (
now - lastSoundTime <
120
) {
return;
}
lastSoundTime = now;
playSlimeSquish();
}
/* =====================================================
スライムを押す
===================================================== */
function touchSlime(x, y) {
const width =
canvas.clientWidth;
const height =
canvas.clientHeight;
if (
width <= 0 ||
height <= 0
) {
return;
}
impactX =
x / width;
impactY =
1 - y / height;
/*
変形強度は常に最大。
スライダーは範囲だけ変更。
*/
impactStrength = 1.0;
playTouchSound();
}
/* =====================================================
指で押す
===================================================== */
document.addEventListener(
"pointerdown",
event => {
if (
  event.target.closest(".top-ui") ||
  event.target.closest(".control-panel")
) {
  return;
}


initAudio();


isDragging = true;


const rect =
  canvas.getBoundingClientRect();


touchSlime(
  event.clientX - rect.left,
  event.clientY - rect.top
);
}
);
/* =====================================================
指でなぞる
===================================================== */
document.addEventListener(
"pointermove",
event => {
if (!isDragging) {
  return;
}


if (
  event.target.closest(".top-ui") ||
  event.target.closest(".control-panel")
) {
  return;
}


const rect =
  canvas.getBoundingClientRect();


touchSlime(
  event.clientX - rect.left,
  event.clientY - rect.top
);
}
);
/* =====================================================
指を離す
===================================================== */
document.addEventListener(
"pointerup",
() => {
isDragging = false;
}
);
/* =====================================================
タッチキャンセル
===================================================== */
document.addEventListener(
"pointercancel",
() => {
isDragging = false;
}
);
/* =====================================================
背景変更
===================================================== */
let backgroundURL = null;
backgroundInput.addEventListener(
"change",
event => {
const file =
  event.target.files &&
  event.target.files[0];


if (!file) {
  return;
}


if (backgroundURL) {

  URL.revokeObjectURL(
    backgroundURL
  );
}


backgroundURL =
  URL.createObjectURL(file);


background.onload =
  () => {

    uploadBackground();
  };


background.src =
  backgroundURL;
}
);
/* =====================================================
リセット
===================================================== */
resetButton.addEventListener(
"click",
() => {
impactStrength = 0;

isDragging = false;
}
);
/* =====================================================
アニメーション
===================================================== */
let startTime =
performance.now();
function render(currentTime) {
const time =
(
currentTime -
startTime
) / 1000;
/*
指を離したあと
ゆっくり元に戻す。
0.985
= ゆっくり戻る。
*/
impactStrength *= 0.985;
gl.useProgram(program);
gl.uniform1f(
timeLocation,
time
);
gl.uniform1f(
waterLocation,
Number(
waterAmount.value
) / 100
);
gl.uniform2f(
resolutionLocation,
canvas.width,
canvas.height
);
gl.uniform2f(
backgroundResolutionLocation,
background.naturalWidth || 1,
background.naturalHeight || 1
);
gl.uniform2f(
impactLocation,
impactX,
impactY
);
gl.uniform1f(
strengthLocation,
impactStrength
);
gl.activeTexture(
gl.TEXTURE0
);
gl.bindTexture(
gl.TEXTURE_2D,
texture
);
gl.uniform1i(
backgroundLocation,
0
);
gl.drawArrays(
gl.TRIANGLES,
0,
6
);
requestAnimationFrame(
render
);
}
requestAnimationFrame(
render
);
