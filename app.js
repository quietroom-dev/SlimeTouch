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

float hash(vec2 p){
  return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);
}

float noise(vec2 p){
  vec2 i=floor(p);
  vec2 f=fract(p);
  f=f*f*(3.0-2.0*f);
  float a=hash(i);
  float b=hash(i+vec2(1.0,0.0));
  float c=hash(i+vec2(0.0,1.0));
  float d=hash(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}

float fbm(vec2 p){
  float value=0.0;
  float amplitude=0.5;
  for(int i=0;i<5;i++){
    value+=noise(p)*amplitude;
    p*=2.0;
    amplitude*=0.5;
  }
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

  if(inside<0.5){
    gl_FragColor=vec4(0.0,0.0,0.0,0.0);
    return;
  }

  vec4 color=texture2D(u_background,imageUV);
  gl_FragColor=vec4(color.rgb,1.0);
}`;

function createShader(type,source){
  const shader=gl.createShader(type);
  gl.shaderSource(shader,source);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
    console.error(gl.getShaderInfoLog(shader));
    throw new Error("Shader compilation failed");
  }
  return shader;
}

const vertexShader=createShader(gl.VERTEX_SHADER,vertexShaderSource);
const fragmentShader=createShader(gl.FRAGMENT_SHADER,fragmentShaderSource);
const program=gl.createProgram();

gl.attachShader(program,vertexShader);
gl.attachShader(program,fragmentShader);
gl.linkProgram(program);

if(!gl.getProgramParameter(program,gl.LINK_STATUS)){
  console.error(gl.getProgramInfoLog(program));
  throw new Error("Program linking failed");
}

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
let lastSoundTime=0;
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

function playNoisePop(volume=0.3,duration=0.07,low=500,high=1800){
  const ctx=audioContext;
  if(!ctx||ctx.state!=="running")return;

  const now=ctx.currentTime;
  const length=Math.floor(ctx.sampleRate*duration);
  const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
  const data=buffer.getChannelData(0);

  for(let i=0;i<length;i++){
    const t=i/length;
    data[i]=(Math.random()*2-1)*Math.pow(1-t,2.4);
  }

  const source=ctx.createBufferSource();
  const filter=ctx.createBiquadFilter();
  const gain=ctx.createGain();

  source.buffer=buffer;
  filter.type="bandpass";
  filter.frequency.setValueAtTime(low+Math.random()*(high-low),now);
  filter.Q.value=1.2;

  gain.gain.setValueAtTime(0.001,now);
  gain.gain.exponentialRampToValueAtTime(volume,now+0.004);
  gain.gain.exponentialRampToValueAtTime(0.001,now+duration);

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(now);
  source.stop(now+duration);
}

function playTonePop(volume=0.18){
  const ctx=audioContext;
  if(!ctx||ctx.state!=="running")return;

  const now=ctx.currentTime;
  const osc=ctx.createOscillator();
  const gain=ctx.createGain();

  osc.type="triangle";
  osc.frequency.setValueAtTime(1100+Math.random()*700,now);
  osc.frequency.exponentialRampToValueAtTime(350+Math.random()*250,now+0.055);

  gain.gain.setValueAtTime(0.001,now);
  gain.gain.exponentialRampToValueAtTime(volume,now+0.003);
  gain.gain.exponentialRampToValueAtTime(0.001,now+0.065);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now+0.07);
}

function playWetPop(type="random",volume=1){
  if(!audioContext||audioContext.state!=="running")return;

  if(type==="random"){
    const r=Math.random();
    type=r<0.42?"nichi":r<0.78?"puchi":"puchu";
  }

  if(type==="nichi"){
    playNoisePop(0.34*volume,0.075,700,1500);
  }else if(type==="puchi"){
    playTonePop(0.22*volume);
  }else{
    playNoisePop(0.28*volume,0.11,350,1100);
    setTimeout(()=>playTonePop(0.10*volume),25);
  }
}

function playSlimePressSound(){
  const r=Math.random();
  if(r<0.45)playWetPop("puchi",1.15);
  else if(r<0.75)playWetPop("nichi",1.15);
  else playWetPop("puchu",1.15);
}

function playSlimeDragSound(){
  if(!audioContext||audioContext.state!=="running")return;

  const now=performance.now();
  if(now<nextDragSoundTime)return;

  nextDragSoundTime=now+55+Math.random()*90;
  playWetPop("random",0.75);
}

function playSlimeReleaseSound(){
  playWetPop("nichi",0.9);
}

function playTouchSound(isDrag=false){
  if(!audioContext||audioContext.state!=="running")return;

  if(isDrag){
    playSlimeDragSound();
    return;
  }

  const now=performance.now();
  if(now-lastSoundTime<60)return;
  lastSoundTime=now;
  playSlimePressSound();
}

function touchSlime(x,y,isDragSound=false){
  const width=canvas.clientWidth;
  const height=canvas.clientHeight;
  if(width<=0||height<=0)return;

  impactX=x/width;
  impactY=1-y/height;
  impactStrength=1.0;
  playTouchSound(isDragSound);
}

function startAudioAndPlay(fn){
  const ctx=initAudio();
  if(!ctx)return;

  if(ctx.state==="running"){
    fn();
  }else{
    ctx.resume().then(()=>fn()).catch(()=>{});
  }
}

document.addEventListener("pointerdown",event=>{
  if(event.target.closest(".top-ui")||event.target.closest(".control-panel"))return;

  isDragging=true;
  nextDragSoundTime=performance.now();

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
