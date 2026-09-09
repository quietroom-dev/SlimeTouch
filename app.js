const canvas=document.getElementById("waterCanvas");
const gl=canvas.getContext("webgl",{alpha:true,antialias:true,premultipliedAlpha:false});
const background=document.getElementById("background");
const waterAmount=document.getElementById("waterAmount");
const waterValue=document.getElementById("waterValue");
const backgroundInput=document.getElementById("backgroundInput");
const resetButton=document.getElementById("resetButton");

if(!gl){alert("このブラウザではWebGLを利用できません。");throw new Error("WebGL unavailable");}

const vertexShaderSource=`
attribute vec2 a_position;
varying vec2 v_uv;
void main(){
v_uv=a_position*0.5+0.5;
gl_Position=vec4(a_position,0.0,1.0);
}`;

const fragmentShaderSource=`
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_background;
uniform float u_time;
uniform float u_water;
uniform vec2 u_resolution;
uniform vec2 u_impact;
uniform float u_impactStrength;
uniform vec2 u_backgroundResolution;

float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){
vec2 i=floor(p),f=fract(p);
f=f*f*(3.0-2.0*f);
float a=hash(i),b=hash(i+vec2(1.0,0.0)),c=hash(i+vec2(0.0,1.0)),d=hash(i+vec2(1.0,1.0));
return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float fbm(vec2 p){
float value=0.0,amplitude=0.5;
for(int i=0;i<5;i++){value+=noise(p)*amplitude;p*=2.0;amplitude*=0.5;}
return value;
}
float slimeDeform(vec2 uv){
vec2 aspect=vec2(u_resolution.x/u_resolution.y,1.0);
vec2 p=(uv-u_impact)*aspect;
float dist=length(p);
float radius=0.025+u_water*0.50;
float n=fbm(p*12.0+vec2(u_time*0.35,-u_time*0.22));
float edge=radius+(n-0.5)*0.025;
float deform=smoothstep(edge+0.055,edge-0.045,dist);
float inner=smoothstep(radius*0.15,radius*0.9,dist);
return deform*(0.58+0.42*inner)*u_impactStrength;
}
vec2 deformBackground(vec2 uv,float deform){
vec2 center=u_impact;
vec2 direction=uv-center;
float distance=length(direction);
float lens=deform*(1.0-smoothstep(0.0,0.12,distance));
float wave=fbm(uv*35.0+vec2(u_time*0.2,u_time*0.13));
vec2 distortion=vec2(wave-0.5,fbm(uv*41.0-vec2(u_time*0.15,u_time*0.08))-0.5);
uv+=direction*lens*0.65;
uv+=distortion*deform*0.045;
uv=center+(uv-center)*(1.0-deform*0.10);
return uv;
}
void main(){
vec2 uv=v_uv;
float deform=slimeDeform(uv);
vec2 deformedUV=deformBackground(uv,deform);
float screenRatio=u_resolution.x/u_resolution.y;
float imageRatio=u_backgroundResolution.x/u_backgroundResolution.y;
vec2 imageUV=deformedUV;
float inside=1.0;
if(screenRatio>imageRatio){
float scale=screenRatio/imageRatio;
imageUV.x=(deformedUV.x-0.5)*scale+0.5;
if(imageUV.x<0.0||imageUV.x>1.0)inside=0.0;
}else{
float scale=imageRatio/screenRatio;
imageUV.y=(deformedUV.y-0.5)*scale+0.5;
if(imageUV.y<0.0||imageUV.y>1.0)inside=0.0;
}
if(inside<0.5){gl_FragColor=vec4(0.0);return;}
vec4 color=texture2D(u_background,imageUV);
gl_FragColor=vec4(color.rgb,1.0);
}`;

function createShader(type,source){
const shader=gl.createShader(type);
gl.shaderSource(shader,source);
gl.compileShader(shader);
if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){console.error(gl.getShaderInfoLog(shader));throw new Error("Shader compilation failed");}
return shader;
}

const vertexShader=createShader(gl.VERTEX_SHADER,vertexShaderSource);
const fragmentShader=createShader(gl.FRAGMENT_SHADER,fragmentShaderSource);
const program=gl.createProgram();
gl.attachShader(program,vertexShader);
gl.attachShader(program,fragmentShader);
gl.linkProgram(program);

if(!gl.getProgramParameter(program,gl.LINK_STATUS)){console.error(gl.getProgramInfoLog(program));throw new Error("Program linking failed");}
gl.useProgram(program);

const buffer=gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);

const positionLocation=gl.getAttribLocation(program,"a_position");
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation,2,gl.FLOAT,false,0,0);

const timeLocation=gl.getUniformLocation(program,"u_time");
const waterLocation=gl.getUniformLocation(program,"u_water");
const resolutionLocation=gl.getUniformLocation(program,"u_resolution");
const impactLocation=gl.getUniformLocation(program,"u_impact");
const strengthLocation=gl.getUniformLocation(program,"u_impactStrength");
const backgroundLocation=gl.getUniformLocation(program,"u_background");
const backgroundResolutionLocation=gl.getUniformLocation(program,"u_backgroundResolution");

const texture=gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D,texture);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);

function uploadBackground(){
if(!background.complete||!background.naturalWidth)return;
gl.bindTexture(gl.TEXTURE_2D,texture);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,background);
}

background.addEventListener("load",uploadBackground);
uploadBackground();

function resize(){
const rect=canvas.getBoundingClientRect();
const ratio=Math.min(window.devicePixelRatio||1,2);
canvas.width=Math.floor(rect.width*ratio);
canvas.height=Math.floor(rect.height*ratio);
gl.viewport(0,0,canvas.width,canvas.height);
}

window.addEventListener("resize",resize);
resize();

waterValue.textContent=waterAmount.value+"%";
waterAmount.addEventListener("input",()=>waterValue.textContent=waterAmount.value+"%");

let impactX=0.5;
let impactY=0.5;
let impactStrength=0;
let isDragging=false;

let audioContext=null;
let nextDragSoundTime=0;

function initAudio(){
if(!audioContext){
const AudioContext=window.AudioContext||window.webkitAudioContext;
if(!AudioContext)return null;
audioContext=new AudioContext();
}
if(audioContext.state==="suspended")audioContext.resume().catch(()=>{});
return audioContext;
}

/* 湿った「ネチッ」系の短い粘着音 */
function playStickySound(volume=1){
const ctx=audioContext;
if(!ctx||ctx.state!=="running")return;

const now=ctx.currentTime;
const duration=0.16;
const length=Math.floor(ctx.sampleRate*duration);
const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
const data=buffer.getChannelData(0);

for(let i=0;i<length;i++){
const t=i/length;
const attack=Math.min(1,t/0.025);
const release=Math.pow(1-t,2.0);
const wobble=Math.sin(t*38)*0.18;
data[i]=(Math.random()*2-1)*attack*release*(0.55+wobble);
}

const source=ctx.createBufferSource();
const filter=ctx.createBiquadFilter();
const gain=ctx.createGain();

source.buffer=buffer;
filter.type="lowpass";
filter.frequency.setValueAtTime(850+Math.random()*350,now);
filter.frequency.exponentialRampToValueAtTime(380,now+duration);
filter.Q.value=0.7;

gain.gain.setValueAtTime(0.001,now);
gain.gain.exponentialRampToValueAtTime(0.20*volume,now+0.018);
gain.gain.exponentialRampToValueAtTime(0.001,now+duration);

source.connect(filter).connect(gain).connect(ctx.destination);
source.start(now);
source.stop(now+duration);
}

/* 小さく湿った「プチュ」 */
function playSoftPop(volume=1){
const ctx=audioContext;
if(!ctx||ctx.state!=="running")return;

const now=ctx.currentTime;
const duration=0.12;
const length=Math.floor(ctx.sampleRate*duration);
const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
const data=buffer.getChannelData(0);

for(let i=0;i<length;i++){
const t=i/length;
data[i]=(Math.random()*2-1)*Math.pow(1-t,3.0);
}

const source=ctx.createBufferSource();
const filter=ctx.createBiquadFilter();
const gain=ctx.createGain();

source.buffer=buffer;
filter.type="lowpass";
filter.frequency.setValueAtTime(700+Math.random()*500,now);
filter.frequency.exponentialRampToValueAtTime(250,now+duration);

gain.gain.setValueAtTime(0.001,now);
gain.gain.exponentialRampToValueAtTime(0.12*volume,now+0.008);
gain.gain.exponentialRampToValueAtTime(0.001,now+duration);

source.connect(filter).connect(gain).connect(ctx.destination);
source.start(now);
source.stop(now+duration);
}

/* 押した瞬間は「プチッ」ではなく粘着音を優先 */
function playSlimePressSound(){
const r=Math.random();
if(r<0.72){
playStickySound(1.0);
}else{
playSoftPop(0.7);
}
}

/* ドラッグ中はかなり控えめ。不規則にだけ鳴る */
function playSlimeDragSound(){
const ctx=audioContext;
if(!ctx||ctx.state!=="running")return;

const now=performance.now();
if(now<nextDragSoundTime)return;

/* 音の間隔を広くする */
nextDragSoundTime=now+150+Math.random()*220;

const r=Math.random();
if(r<0.72){
playStickySound(0.55);
}else{
playSoftPop(0.42);
}
}

/* 離したとき */
function playSlimeReleaseSound(){
if(!audioContext||audioContext.state!=="running")return;
playStickySound(0.65);
}

function touchSlime(x,y,dragSound=false){
const width=canvas.clientWidth;
const height=canvas.clientHeight;
if(width<=0||height<=0)return;

impactX=x/width;
impactY=1-y/height;
impactStrength=1.0;

if(dragSound)playSlimeDragSound();
}

function startAudioAndPlay(fn){
const ctx=initAudio();
if(!ctx)return;
if(ctx.state==="running")fn();
else ctx.resume().then(()=>fn()).catch(()=>{});
}

document.addEventListener("pointerdown",event=>{
if(event.target.closest(".top-ui")||event.target.closest(".control-panel"))return;

isDragging=true;
nextDragSoundTime=performance.now()+180;

const rect=canvas.getBoundingClientRect();
touchSlime(event.clientX-rect.left,event.clientY-rect.top,false);
startAudioAndPlay(playSlimePressSound);
});

document.addEventListener("pointermove",event=>{
if(!isDragging)return;
if(event.target.closest(".top-ui")||event.target.closest(".control-panel"))return;

const rect=canvas.getBoundingClientRect();
touchSlime(event.clientX-rect.left,event.clientY-rect.top,true);
});

document.addEventListener("pointerup",()=>{
if(isDragging)playSlimeReleaseSound();
isDragging=false;
});

document.addEventListener("pointercancel",()=>{
isDragging=false;
});

let backgroundURL=null;

backgroundInput.addEventListener("change",event=>{
const file=event.target.files&&event.target.files[0];
if(!file)return;

if(backgroundURL)URL.revokeObjectURL(backgroundURL);

backgroundURL=URL.createObjectURL(file);
background.onload=()=>uploadBackground();
background.src=backgroundURL;
});

resetButton.addEventListener("click",()=>{
impactStrength=0;
isDragging=false;
});

let startTime=performance.now();

function render(currentTime){
const time=(currentTime-startTime)/1000;
impactStrength*=0.985;

gl.useProgram(program);
gl.uniform1f(timeLocation,time);
gl.uniform1f(waterLocation,Number(waterAmount.value)/100);
gl.uniform2f(resolutionLocation,canvas.width,canvas.height);
gl.uniform2f(backgroundResolutionLocation,background.naturalWidth||1,background.naturalHeight||1);
gl.uniform2f(impactLocation,impactX,impactY);
gl.uniform1f(strengthLocation,impactStrength);

gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D,texture);
gl.uniform1i(backgroundLocation,0);
gl.drawArrays(gl.TRIANGLES,0,6);

requestAnimationFrame(render);
}

requestAnimationFrame(render);
