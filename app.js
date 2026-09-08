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
   水膜
--------------------------------- */

float waterFilm(
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


  float radius =
    .08 +
    u_impactStrength *
    .48;


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


  float film =
    smoothstep(
      edge+.06,
      edge-.05,
      dist
    );


  float inner =
    smoothstep(
      radius*.15,
      radius*.9,
      dist
    );


  return
    film *
    (.55+.45*inner);
}


/* ---------------------------------
   水滴
--------------------------------- */

float droplet(
  vec2 uv,
  vec2 center,
  float radius
) {

  vec2 aspect =
    vec2(
      u_resolution.x /
      u_resolution.y,
      1.0
    );

  vec2 p =
    (uv-center)
    *
    aspect;


  float d =
    length(p);


  float n =
    fbm(
      p*55.0
    );


  float r =
    radius +
    (
      n-.5
    )
    *
    radius*.18;


  return
    1.0 -
    smoothstep(
      r*.72,
      r,
      d
    );
}


/* ---------------------------------
   大量の水滴フィールド
--------------------------------- */

float dropletField(
  vec2 uv
) {

  float result = 0.0;


  vec2 grid =
    floor(
      uv *
      vec2(
        18.0,
        32.0
      )
    );


  for (
    int y=-1;
    y<=1;
    y++
  ) {

    for (
      int x=-1;
      x<=1;
      x++
    ) {

      vec2 cell =
        grid +
        vec2(
          float(x),
          float(y)
        );


      float rnd =
        hash(cell);


      vec2 center =
        (
          cell +
          vec2(
            .5 +
            (
              rnd-.5
            )*.7,

            .5 +
            (
              hash(
                cell+13.4
              )-.5
            )*.7
          )
        )
        /
        vec2(
          18.0,
          32.0
        );


      float size =
        mix(
          .008,
          .032,
          hash(
            cell+41.3
          )
        );


      result =
        max(
          result,
          droplet(
            uv,
            center,
            size
          )
        );
    }
  }


  return result;
}


/* ---------------------------------
   水の屈折
--------------------------------- */

vec2 refractBackground(
  vec2 uv,
  float film,
  float drops
) {

  vec2 center =
    u_impact;


  vec2 direction =
    uv-center;


  float distance =
    length(
      direction
    );


  float lens =
    drops *
    (
      1.0 -
      smoothstep(
        0.0,
        .08,
        distance
      )
    );


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


  uv +=
    direction *
    lens *
    .42;


  uv +=
    distortion *
    film *
    .055;


  uv =
    center +
    (
      uv-center
    )
    *
    (
      1.0 -
      film*.10
    );


  return uv;
}


/* ---------------------------------
   メイン
--------------------------------- */

void main() {

  vec2 uv =
    v_uv;


  float drops =
    dropletField(
      uv
    )
    *
    u_water;


  float film =
    waterFilm(
      uv
    )
    *
    u_water;


  vec2 refractedUV =
    refractBackground(
      uv,
      film,
      drops
    );


  vec4 color =
    texture2D(
      u_background,
      refractedUV
    );


  float waterBrightness =
    film*.12 +
    drops*.08;


  color.rgb +=
    waterBrightness;


  float edge =
    drops -
    smoothstep(
      .0,
      .8,
      drops
    );


  color.rgb +=
    vec3(
      .75,
      .9,
      1.0
    )
    *
    drops
    *
    .22;


  float reflection =
    pow(
      max(
        0.0,
        fbm(
          uv*70.0
        )
      ),
      4.0
    );


  color.rgb +=
    vec3(
      .8,
      .94,
      1.0
    )
    *
    reflection
    *
    film
    *
    .12;


  color.rgb =
    mix(
      color.rgb,
      color.rgb *
      vec3(
        .94,
        .98,
        1.02
      ),
      film*.25
    );


  color.rgb +=
    edge *
    vec3(
      .8,
      .95,
      1.0
    )
    *
    .45;


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
   水量
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
   タップ位置
===================================================== */

let impactX = .5;
let impactY = .5;

let impactStrength = 0;


/* =====================================================
   水流パーティクル
===================================================== */

let streamParticles = [];


function random(
  min,
  max
) {

  return (
    min +
    Math.random() *
    (max-min)
  );
}


function shootWater(
  x,
  y
) {

  impactX =
    x / canvas.clientWidth;

  impactY =
    1 -
    y / canvas.clientHeight;


  impactStrength =
    Number(
      waterAmount.value
    ) / 100;


  const amount =
    Number(
      waterAmount.value
    );


  const count =
    Math.floor(
      90 +
      amount * 2.5
    );


  const sourceX =
    canvas.clientWidth *
    .5;


  const sourceY =
    canvas.clientHeight *
    .34;


  const dx =
    x-sourceX;


  const dy =
    y-sourceY;


  const distance =
    Math.hypot(
      dx,
      dy
    );


  /*
    sourceと同じ位置を
    タップした場合の
    0除算を防ぐ
  */

  if (distance < 0.001) {
    return;
  }


  const nx =
    dx /
    distance;


  const ny =
    dy /
    distance;


  for (
    let i=0;
    i<count;
    i++
  ) {

    const progress =
      Math.random();


    const spread =
      random(
        -1,
        1
      )
      *
      (
        3 +
        amount*.09
      )
      *
      progress;


    streamParticles.push({

      x:
        sourceX +
        dx *
        progress,

      y:
        sourceY +
        dy *
        progress,

      vx:
        nx *
        random(
          550,
          850
        ),

      vy:
        ny *
        random(
          550,
          850
        ),

      size:
        random(
          1,
          5
        ),

      life:
        random(
          .25,
          .75
        )
    });
  }
}


/* =====================================================
   タップ・指でなぞる
===================================================== */

let isDragging = false;


/*
  指を押した
*/

document.addEventListener(
  "pointerdown",
  event => {

    if (
      event.target.closest(".top-ui") ||
      event.target.closest(".control-panel")
    ) {
      return;
    }


    isDragging = true;


    const rect =
      canvas.getBoundingClientRect();


    shootWater(
      event.clientX -
        rect.left,

      event.clientY -
        rect.top
    );
  }
);


/*
  指を動かしている
*/

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


    shootWater(
      event.clientX -
        rect.left,

      event.clientY -
        rect.top
    );
  }
);


/*
  指を離した
*/

document.addEventListener(
  "pointerup",
  () => {

    isDragging = false;
  }
);


/*
  指をキャンセルした
*/

document.addEventListener(
  "pointercancel",
  () => {

    isDragging = false;
  }
);


/*
  指が画面外へ出た場合
*/

document.addEventListener(
  "pointerleave",
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

    impactStrength = 0;

    streamParticles = [];

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
    水の衝突を
    徐々に消す
  */

  impactStrength *= .985;


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
```
