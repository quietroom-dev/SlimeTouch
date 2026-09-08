const canvas =
  document.getElementById(
    "waterCanvas"
  );

const gl =
  canvas.getContext(
    "webgl",
    {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false
    }
  );

const background =
  document.getElementById(
    "background"
  );

const waterAmount =
  document.getElementById(
    "waterAmount"
  );

const waterValue =
  document.getElementById(
    "waterValue"
  );

const backgroundInput =
  document.getElementById(
    "backgroundInput"
  );

const resetButton =
  document.getElementById(
    "resetButton"
  );


if (!gl) {

  alert(
    "このブラウザではWebGLを利用できません。"
  );

  throw new Error(
    "WebGL unavailable"
  );
}


/* =====================================================
   WebGL shader
===================================================== */

const vertexShaderSource = `

attribute vec2 a_position;

varying vec2 v_uv;

void main() {

  v_uv =
    a_position *
    0.5 +
    0.5;

  gl_Position =
    vec4(
      a_position,
      0.0,
      1.0
    );
}

`;


const fragmentShaderSource = `

precision highp float;

varying vec2 v_uv;

uniform sampler2D u_background;

uniform float u_time;

uniform float u_water;

uniform vec2 u_resolution;

uniform vec2 u_impact;

uniform float u_impactStrength;

uniform float u_backgroundRatio;

/* ---------------------------------
   hash
--------------------------------- */

float hash(
  vec2 p
) {

  return fract(
    sin(
      dot(
        p,
        vec2(
          127.1,
          311.7
        )
      )
    )
    *
    43758.5453123
  );
}


/* ---------------------------------
   noise
--------------------------------- */

float noise(
  vec2 p
) {

  vec2 i =
    floor(p);

  vec2 f =
    fract(p);

  f =
    f*f*
    (3.0-2.0*f);

  float a =
    hash(i);

  float b =
    hash(i+vec2(1.0,0.0));

  float c =
    hash(i+vec2(0.0,1.0));

  float d =
    hash(i+vec2(1.0,1.0));

  return mix(
    mix(a,b,f.x),
    mix(c,d,f.x),
    f.y
  );
}


/* ---------------------------------
   FBM
--------------------------------- */

float fbm(
  vec2 p
) {

  float value = 0.0;

  float amplitude = .5;

  for (
    int i=0;
    i<5;
    i++
  ) {

    value +=
      noise(p)
      *
      amplitude;

    p *= 2.0;

    amplitude *= .5;
  }

  return value;
}


/* ---------------------------------
   スライムの変形
--------------------------------- */

float slimeDeform(
  vec2 uv
) {

  vec2 aspect =
    vec2(
      u_resolution.x /
      u_resolution.y,
      1.0
    );


  vec2 p =
    (uv-u_impact)
    *
    aspect;


  float dist =
    length(p);


  /*
    指で押した範囲。

    水量スライダーを
    スライムの変形量として使用。
  */

  float radius =
  (
    .025 +
    u_water *
    .50
  )
  *
  u_impactStrength;

  /*
    スライムらしい
    少し不規則な輪郭
  */

  float n =
    fbm(
      p*12.0 +
      vec2(
        u_time*.35,
        -u_time*.22
      )
    );


  float edge =
    radius +
    (
      n-.5
    )
    *
    .09;


  /*
    押した部分。
  */

  float deform =
    smoothstep(
      edge+.06,
      edge-.05,
      dist
    );


  /*
    中心は強く、
    外側に行くほど弱くする。
  */

  float inner =
    smoothstep(
      radius*.15,
      radius*.9,
      dist
    );


  return
    deform *
    (.55+.45*inner);
}


/* ---------------------------------
   背景の変形
--------------------------------- */

vec2 deformBackground(
  vec2 uv,
  float deform
) {

  vec2 center =
    u_impact;


  vec2 direction =
    uv-center;


  float distance =
    length(
      direction
    );


  /*
    スライムを押したときの
    レンズのような変形。
  */

  float lens =
    deform *
    (
      1.0 -
      smoothstep(
        0.0,
        .08,
        distance
      )
    );


  /*
    スライム表面の
    ゆっくりした揺らぎ。
  */

  float wave =
    fbm(
      uv*35.0 +
      vec2(
        u_time*.2,
        u_time*.13
      )
    );


  vec2 distortion =
    vec2(
      wave-.5,

      fbm(
        uv*41.0
        -
        vec2(
          u_time*.15
        )
      )-.5
    );


  /*
    中心付近を
    大きく引き伸ばす。
  */

  uv +=
  direction *
  lens *
  .65;

  /*
    表面のネチネチした
    微妙な揺れ。
  */

  uv +=
    distortion *
    deform *
    .055;


  /*
    スライムを押した部分を
    少しだけ拡大。
  */

  uv =
    center +
    (
      uv-center
    )
    *
    (
      1.0 -
      deform*.10
    );


  return uv;
}


/* ---------------------------------
   メイン
--------------------------------- */

void main() {

  vec2 uv =
    v_uv;

  float screenRatio =
    u_resolution.x /
    u_resolution.y;

  float imageRatio =
    u_backgroundRatio;

  if (screenRatio > imageRatio) {

    float scale =
      imageRatio /
      screenRatio;

    uv.y =
      (uv.y - .5) *
      scale +
      .5;

  } else {

    float scale =
      screenRatio /
      imageRatio;

    uv.x =
      (uv.x - .5) *
      scale +
      .5;
  }


  /*
    スライムの変形量
  */

  float deform =
  slimeDeform(
    uv
  );

  /*
    背景画像を変形
  */

  vec2 deformedUV =
  deformBackground(
    uv,
    deform
  );

  /*
    元画像
  */

  vec4 color =
    texture2D(
      u_background,
      deformedUV
    );


  /*
    ここでは水滴や白い丸は
    一切描画しない。

    背景画像そのものだけを
    変形させる。
  */

  gl_FragColor =
    vec4(
      color.rgb,
      1.0
    );
}

`;


/* =====================================================
   shader compile
===================================================== */

function createShader(
  type,
  source
) {

  const shader =
    gl.createShader(
      type
    );

  gl.shaderSource(
    shader,
    source
  );

  gl.compileShader(
    shader
  );


  if (
    !gl.getShaderParameter(
      shader,
      gl.COMPILE_STATUS
    )
  ) {

    console.error(
      gl.getShaderInfoLog(
        shader
      )
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

gl.linkProgram(
  program
);


if (
  !gl.getProgramParameter(
    program,
    gl.LINK_STATUS
  )
) {

  throw new Error(
    gl.getProgramInfoLog(
      program
    )
  );
}


gl.useProgram(
  program
);


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
    -1,-1,
     1,-1,
    -1, 1,

    -1, 1,
     1,-1,
     1, 1
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
   uniforms
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

const backgroundRatioLocation =
  gl.getUniformLocation(
    program,
    "u_backgroundRatio"
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
   画像をGPUへ
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
   サイズ
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
   スライム量
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
   スライムの接触位置
===================================================== */

let impactX = .5;
let impactY = .5;

let impactStrength = 0;

let isDragging = false;


/* =====================================================
   音
===================================================== */

let audioContext = null;


/*
  最初のタップで
  AudioContextを開始。
*/

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


/*
  ネチネチ音
*/

function playSquishSound() {

  if (!audioContext) {
    return;
  }


  const now =
    audioContext.currentTime;


  /*
    小さなノイズ
  */

  const buffer =
    audioContext.createBuffer(
      1,
      audioContext.sampleRate * .12,
      audioContext.sampleRate
    );


  const data =
    buffer.getChannelData(0);


  for (
    let i = 0;
    i < data.length;
    i++
  ) {

    data[i] =
      (
        Math.random() * 2 - 1
      )
      *
      Math.pow(
        1 - i / data.length,
        2
      );
  }


  const noise =
    audioContext.createBufferSource();


  noise.buffer =
    buffer;


  /*
    ローパスで
    「ネチッ」とした
    柔らかい音にする。
  */

  const filter =
    audioContext.createBiquadFilter();


  filter.type =
    "lowpass";


  filter.frequency.setValueAtTime(
    900,
    now
  );


  filter.frequency.exponentialRampToValueAtTime(
    180,
    now + .12
  );


  const gain =
    audioContext.createGain();


  gain.gain.setValueAtTime(
    0,
    now
  );


  gain.gain.linearRampToValueAtTime(
    .12,
    now + .015
  );


  gain.gain.exponentialRampToValueAtTime(
    .001,
    now + .12
  );


  noise
    .connect(filter)
    .connect(gain)
    .connect(audioContext.destination);


  noise.start(
    now
  );

  noise.stop(
    now + .12
  );


  /*
    少し低い音を加えて
    「むにっ」という感触を作る。
  */

  const oscillator =
    audioContext.createOscillator();


  const oscillatorGain =
    audioContext.createGain();


  oscillator.type =
    "sine";


  oscillator.frequency.setValueAtTime(
    90 + Math.random() * 50,
    now
  );


  oscillator.frequency.exponentialRampToValueAtTime(
    55,
    now + .13
  );


  oscillatorGain.gain.setValueAtTime(
    0,
    now
  );


  oscillatorGain.gain.linearRampToValueAtTime(
    .08,
    now + .015
  );


  oscillatorGain.gain.exponentialRampToValueAtTime(
    .001,
    now + .13
  );


  oscillator
    .connect(oscillatorGain)
    .connect(audioContext.destination);


  oscillator.start(
    now
  );

  oscillator.stop(
    now + .13
  );
}


/*
  プチッという小さな音
*/

function playPopSound() {

  if (!audioContext) {
    return;
  }


  const now =
    audioContext.currentTime;


  const oscillator =
    audioContext.createOscillator();


  const gain =
    audioContext.createGain();


  oscillator.type =
    "sine";


  oscillator.frequency.setValueAtTime(
    280 + Math.random() * 140,
    now
  );


  oscillator.frequency.exponentialRampToValueAtTime(
    90,
    now + .08
  );


  gain.gain.setValueAtTime(
    .001,
    now
  );


  gain.gain.exponentialRampToValueAtTime(
    .13,
    now + .006
  );


  gain.gain.exponentialRampToValueAtTime(
    .001,
    now + .08
  );


  oscillator
    .connect(gain)
    .connect(audioContext.destination);


  oscillator.start(
    now
  );

  oscillator.stop(
    now + .08
  );
}


/*
  連続再生しすぎないための
  タイマー
*/

let lastSoundTime = 0;


function playTouchSound() {

  if (!audioContext) {
    return;
  }


  const now =
    performance.now();


  /*
    約0.08秒に1回まで。
  */

  if (
    now -
    lastSoundTime
    <
    80
  ) {
    return;
  }


  lastSoundTime =
    now;


  /*
    ランダムで
    ネチネチ / プチプチ
  */

  if (
    Math.random() < .72
  ) {

    playSquishSound();

  } else {

    playPopSound();
  }
}


/* =====================================================
   スライムを押す
===================================================== */

function touchSlime(
  x,
  y
) {

  impactX =
    x /
    canvas.clientWidth;

  impactY =
    1 -
    y /
    canvas.clientHeight;

  /*
    スライダーは
    「変形する範囲」だけを変更する。

    変形そのものの強さは
    常に最大に近い状態にする。
  */

  impactStrength =
    1.0;

  playTouchSound();
}


/* =====================================================
   指で触る
===================================================== */

document.addEventListener(
  "pointerdown",
  event => {

    /*
      UIを触った場合は
      スライムを反応させない。
    */

    if (
      event.target.closest(
        ".top-ui"
      ) ||
      event.target.closest(
        ".control-panel"
      )
    ) {

      return;
    }


    initAudio();


    isDragging =
      true;


    const rect =
      canvas.getBoundingClientRect();


    touchSlime(
      event.clientX -
        rect.left,

      event.clientY -
        rect.top
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
      event.target.closest(
        ".top-ui"
      ) ||
      event.target.closest(
        ".control-panel"
      )
    ) {

      return;
    }


    const rect =
      canvas.getBoundingClientRect();


    touchSlime(
      event.clientX -
        rect.left,

      event.clientY -
        rect.top
    );
  }
);


/* =====================================================
   指を離す
===================================================== */

document.addEventListener(
  "pointerup",
  () => {

    isDragging =
      false;
  }
);


/* =====================================================
   タッチキャンセル
===================================================== */

document.addEventListener(
  "pointercancel",
  () => {

    isDragging =
      false;
  }
);


/* =====================================================
   背景変更
===================================================== */

let backgroundURL =
  null;


backgroundInput.addEventListener(
  "change",
  event => {

    const file =
      event.target.files?.[0];


    if (!file) {
      return;
    }


    if (backgroundURL) {

      URL.revokeObjectURL(
        backgroundURL
      );
    }


    backgroundURL =
      URL.createObjectURL(
        file
      );


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

    impactStrength =
      0;

    isDragging =
      false;
  }
);


/* =====================================================
   アニメーション
===================================================== */

let startTime =
  performance.now();


function render(
  currentTime
) {

  const time =
    (
      currentTime -
      startTime
    ) / 1000;


  /*
    指を離したあと
    スライムがゆっくり戻る。
  */

  impactStrength *=
    .97;


  gl.useProgram(
    program
  );


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

  gl.uniform1f(
  backgroundRatioLocation,

  background.naturalWidth /
  background.naturalHeight
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
