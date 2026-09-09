const canvas=document.getElementById("waterCanvas");
const gl=canvas.getContext("webgl",{alpha:true,antialias:true,premultipliedAlpha:false});
const background=document.getElementById("background");
const waterAmount=document.getElementById("waterAmount");
const waterValue=document.getElementById("waterValue");
const backgroundInput=document.getElementById("backgroundInput");
const resetButton=document.getElementById("resetButton");

if(!gl){alert("このブラウザではWebGLを利用できません。");throw new Error("WebGL unavailable");}

const vertexShaderSource=`attribute vec2 a_position;varying vec2 v_uv;void main(){v_uv=a_position*0.5+0.5;gl_Position=vec4(a_position,0.0,1.0);}`;

const fragmentShaderSource=`precision highp float;
varying vec2 v_uv;
uniform sampler2D u_background;
uniform float u_time;
uniform float u_water;
uniform vec2 u_resolution;
uniform vec2 u_impact;
uniform float u_impactStrength;
uniform vec2 u_backgroundResolution;

float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=hash(i),b=hash(i+vec2(1.0,0.0)),c=hash(i+vec2(0.0,1.0)),d=hash(i+vec2(1.0,1.0));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
float fbm(vec2 p){float value=0.0,amplitude=0.5;for(int i=0;i<5;i++){value+=noise(p)*amplitude;p*=2.0;amplitude*=0.5;}return value;}

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
let soundBuffers=[];
let soundReady=false;
let nextDragSoundTime=0;
let lastSoundIndex=-1;
let lastPointerX=0;
let lastPointerY=0;
let lastPointerTime=0;
let dragSpeed=0;

const soundFiles=["sounds/sticky01.mp3","sounds/sticky02.mp3","sounds/sticky03.mp3","sounds/sticky04.mp3","sounds/sticky05.mp3","sounds/sticky06.mp3"];

async function initAudio(){
if(!audioContext){
const AudioContext=window.AudioContext||window.webkitAudioContext;
if(!AudioContext)return null;
audioContext=new AudioContext();
}
if(audioContext.state==="suspended")await audioContext.resume();

if(!soundReady){
try{
soundBuffers=await Promise.all(soundFiles.map(async file=>{
const response=await fetch(file);
if(!response.ok)throw new Error("音声ファイルが見つかりません: "+file);
const arrayBuffer=await response.arrayBuffer();
return await audioContext.decodeAudioData(arrayBuffer);
}));
soundReady=true;
}catch(error){
console.error("音声読み込み失敗:",error);
}
}
return audioContext;
}

function chooseSoundIndex(){
const weights=[0.10,0.25,0.25,0.25,0.075,0.075];
let random=Math.random();
let index=0;
for(let i=0;i<weights.length;i++){
random-=weights[i];
if(random<=0){index=i;break;}
}
if(soundBuffers.length>1&&index===lastSoundIndex)index=(index+1)%soundBuffers.length;
lastSoundIndex=index;
return index;
}

function playReferenceSound(volume=0.7,playbackRate=1.0){
if(!audioContext||audioContext.state!=="running"||!soundBuffers.length)return;

const index=chooseSoundIndex();
const source=audioContext.createBufferSource();
const gain=audioContext.createGain();

source.buffer=soundBuffers[index];
source.playbackRate.value=Math.max(0.65,Math.min(1.30,playbackRate*(0.97+Math.random()*0.06)));
gain.gain.setValueAtTime(volume*(0.90+Math.random()*0.10),audioContext.currentTime);

source.connect(gain).connect(audioContext.destination);
source.start();
}

function playPressSound(){
playReferenceSound(0.70,0.96);
}

function playDragSound(){
if(!audioContext||audioContext.state!=="running"||!soundReady)return;

const now=performance.now();
if(now<nextDragSoundTime)return;

nextDragSoundTime=now+155+Math.random()*45;

const speed=Math.max(0,Math.min(dragSpeed,2.2));
const normalized=speed/2.2;
const playbackRate=0.78+normalized*0.42;
const volume=0.27+normalized*0.10;

playReferenceSound(volume,playbackRate);
}

function playReleaseSound(){
playReferenceSound(0.30,0.90);
}

function touchSlime(x,y,dragSound=false){
const width=canvas.clientWidth;
const height=canvas.clientHeight;
if(width<=0||height<=0)return;

impactX=x/width;
impactY=1-y/height;
impactStrength=1.0;

if(dragSound)playDragSound();
}

function startAudioAndPlay(fn){
if(!audioContext){
const AudioContext=window.AudioContext||window.webkitAudioContext;
if(!AudioContext)return;
audioContext=new AudioContext();
}
if(audioContext.state==="suspended"){
audioContext.resume().then(()=>{initAudio().then(()=>fn()).catch(()=>{});}).catch(()=>{});
}else{
initAudio().then(()=>fn()).catch(()=>{});
}
}

document.addEventListener("pointerdown",event=>{
if(event.target.closest(".top-ui")||event.target.closest(".control-panel"))return;

isDragging=true;
nextDragSoundTime=performance.now()+140;

const rect=canvas.getBoundingClientRect();
const x=event.clientX-rect.left;
const y=event.clientY-rect.top;

lastPointerX=x;
lastPointerY=y;
lastPointerTime=performance.now();
dragSpeed=0;

touchSlime(x,y,false);
startAudioAndPlay(playPressSound);
});

document.addEventListener("pointermove",event=>{
if(!isDragging)return;
if(event.target.closest(".top-ui")||event.target.closest(".control-panel"))return;

const rect=canvas.getBoundingClientRect();
const x=event.clientX-rect.left;
const y=event.clientY-rect.top;
const now=performance.now();
const dt=Math.max(8,now-lastPointerTime);
const distance=Math.hypot(x-lastPointerX,y-lastPointerY);

const instantSpeed=distance/dt;
dragSpeed=dragSpeed*0.72+instantSpeed*0.28;

lastPointerX=x;
lastPointerY=y;
lastPointerTime=now;

touchSlime(x,y,true);
});

document.addEventListener("pointerup",()=>{
if(isDragging)playReleaseSound();
isDragging=false;
dragSpeed=0;
});

document.addEventListener("pointercancel",()=>{
isDragging=false;
dragSpeed=0;
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
impactX=0.5;
impactY=0.5;
isDragging=false;
dragSpeed=0;

if(backgroundURL){
URL.revokeObjectURL(backgroundURL);
backgroundURL=null;
}

background.src="background.png";
background.onload=()=>uploadBackground();
backgroundInput.value="";
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
