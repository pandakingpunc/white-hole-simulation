export const noiseGLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));
  vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1;
  i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m; m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0;
  vec3 h=abs(x)-0.5;
  vec3 ox=floor(x+0.5);
  vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g;
  g.x=a0.x*x0.x+h.x*x0.y;
  g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}
float fbm(vec2 p){
  float f=0.0; float a=0.5;
  for(int i=0;i<5;i++){ f+=a*snoise(p); p*=2.03; a*=0.5; }
  return f;
}
`;

// Temperature palette: t=1 hottest (blue-white) -> t=0 coolest (deep red)
export const paletteGLSL = /* glsl */ `
vec3 heat(float t){
  t=clamp(t,0.0,1.0);
  vec3 c0=vec3(0.35,0.03,0.02);
  vec3 c1=vec3(1.0,0.32,0.06);
  vec3 c2=vec3(1.0,0.78,0.38);
  vec3 c3=vec3(1.0,0.97,0.9);
  vec3 c4=vec3(0.72,0.86,1.0);
  if(t<0.25) return mix(c0,c1,t/0.25);
  if(t<0.5) return mix(c1,c2,(t-0.25)/0.25);
  if(t<0.78) return mix(c2,c3,(t-0.5)/0.28);
  return mix(c3,c4,(t-0.78)/0.22);
}
`;

export const diskParticlesVert = /* glsl */ `
uniform float uFlow;
uniform float uRot;
uniform float uSize;
uniform float uPixelRatio;
uniform float uInner;
uniform float uOuter;
uniform float uBurst;
attribute vec4 aSeed;
varying vec3 vColor;
varying float vAlpha;
${paletteGLSL}
void main(){
  float speedVar = 0.55 + 0.45*aSeed.y;
  float life = fract(aSeed.x + uFlow*0.06*speedVar);
  float r = uInner + (uOuter-uInner)*pow(life,1.55);
  // spiral arms + diffuse population
  float arm = step(0.45, aSeed.w);
  float baseA = aSeed.z*6.28318;
  float armA = floor(aSeed.z*2.0)*3.14159 + (fract(aSeed.z*7.13)-0.5)*0.9;
  float a0 = mix(baseA, armA, arm);
  float ang = a0 + log(r)*2.2 + uRot*3.2/pow(r/uInner,1.25);
  float thick = (fract(aSeed.w*13.7)-0.5)*(0.08 + r*0.045)*(1.0+uBurst*1.5);
  vec3 pos = vec3(cos(ang)*r, thick, sin(ang)*r);
  vec4 mv = modelViewMatrix*vec4(pos,1.0);
  gl_Position = projectionMatrix*mv;
  float s = uSize*(0.6+aSeed.y*0.9)*(1.0+ (1.0-life)*1.2);
  gl_PointSize = s*uPixelRatio*(60.0/-mv.z);
  float temp = 1.0 - pow(life,0.7);
  vColor = heat(temp*1.05 + uBurst*0.3);
  vAlpha = smoothstep(0.0,0.04,life)*(1.0-smoothstep(0.7,1.0,life))*(0.55+0.45*arm);
}
`;

export const particlesFrag = /* glsl */ `
uniform float uIntensity;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord-0.5;
  float d = length(c);
  float a = smoothstep(0.5,0.0,d);
  a = a*a;
  gl_FragColor = vec4(vColor*uIntensity, a*vAlpha);
}
`;

export const jetVert = /* glsl */ `
uniform float uFlow;
uniform float uRot;
uniform float uSize;
uniform float uPixelRatio;
uniform float uLength;
uniform float uBurst;
attribute vec4 aSeed;
varying vec3 vColor;
varying float vAlpha;
void main(){
  float side = aSeed.w>0.5?1.0:-1.0;
  float life = fract(aSeed.x + uFlow*0.11*(0.7+0.3*aSeed.y));
  float h = 0.9 + life*uLength*(1.0+uBurst*0.6);
  float spread = (0.06 + pow(life,1.3)*1.6)*sqrt(aSeed.y);
  float ang = aSeed.z*6.28318 + life*9.0*side + uRot*2.0;
  vec3 pos = vec3(cos(ang)*spread, h*side, sin(ang)*spread);
  vec4 mv = modelViewMatrix*vec4(pos,1.0);
  gl_Position = projectionMatrix*mv;
  gl_PointSize = uSize*(1.4-life*0.8)*uPixelRatio*(60.0/-mv.z);
  vColor = mix(vec3(0.85,0.95,1.0), vec3(0.45,0.35,1.0), life);
  vColor = mix(vColor, vec3(1.0,0.4,0.9), smoothstep(0.6,1.0,life)*0.5);
  vAlpha = smoothstep(0.0,0.05,life)*(1.0-smoothstep(0.55,1.0,life))*0.8;
}
`;

export const coreVert = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vPos;
void main(){
  vec4 wp = modelMatrix*vec4(position,1.0);
  vPos = position;
  vNormal = normalize(normalMatrix*normal);
  vec4 mv = viewMatrix*wp;
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix*mv;
}
`;

export const coreFrag = /* glsl */ `
uniform float uTime;
uniform float uWhite; // 1 = white hole, 0 = black hole
uniform float uBurst;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vPos;
${noiseGLSL}
void main(){
  float f = 1.0 - max(dot(vNormal,vView),0.0);
  vec2 sp = vec2(atan(vPos.z,vPos.x)*1.5, vPos.y*3.0);
  float n = fbm(sp*1.5 + vec2(uTime*0.4, -uTime*0.7));
  float n2 = fbm(sp*4.0 - vec2(uTime*0.9, uTime*0.3));
  vec3 white = vec3(1.0,0.98,0.95)*(2.6 + n*0.6 + n2*0.3 + uBurst*3.0);
  white += vec3(0.4,0.6,1.0)*pow(f,2.0)*3.0;
  vec3 black = vec3(0.0);
  black += vec3(1.0,0.55,0.2)*pow(f,6.0)*2.5;
  vec3 col = mix(black, white, uWhite);
  gl_FragColor = vec4(col,1.0);
}
`;

export const shellVert = coreVert;
export const shellFrag = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vPos;
${noiseGLSL}
void main(){
  float f = 1.0 - abs(dot(vNormal,vView));
  float n = 0.6 + 0.4*snoise(vPos.xy*2.0 + uTime);
  float a = pow(f,3.0)*uOpacity*n;
  gl_FragColor = vec4(uColor*a*1.6, a);
}
`;

export const diskGasVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vPos;
void main(){
  vPos = position;
  gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);
}
`;

export const diskGasFrag = /* glsl */ `
uniform float uFlow;
uniform float uRot;
uniform float uInner;
uniform float uOuter;
uniform float uIntensity;
varying vec3 vPos;
${noiseGLSL}
${paletteGLSL}
void main(){
  float r = length(vPos.xy);
  float a = atan(vPos.y, vPos.x);
  float lr = log(r);
  float swirl = a + lr*2.2 + uRot*3.2/pow(r/uInner,1.25);
  vec2 p = vec2(cos(swirl), sin(swirl))*1.6 + vec2(lr*3.0 - uFlow*0.35, 0.0);
  float n = fbm(p*1.4 + vec2(0.0, lr*2.0 - uFlow*0.2));
  float arms = 0.5+0.5*cos(2.0*(a + lr*2.2 + uRot*3.2/pow(r/uInner,1.25)));
  float t = clamp((r-uInner)/(uOuter-uInner),0.0,1.0);
  float dens = (0.35 + 0.65*arms)*(0.55+0.6*n);
  float fade = smoothstep(0.0,0.06,t)*(1.0-smoothstep(0.45,1.0,t));
  vec3 col = heat(1.0 - pow(t,0.6));
  float alpha = dens*fade*0.55;
  gl_FragColor = vec4(col*alpha*uIntensity, alpha);
}
`;

export const backgroundVert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0);
  gl_Position = p.xyww;
}
`;

export const backgroundFrag = /* glsl */ `
varying vec3 vDir;
${noiseGLSL}
void main(){
  vec3 d = normalize(vDir);
  vec2 uv = vec2(atan(d.z,d.x), asin(d.y));
  float n1 = fbm(uv*1.4 + 3.0);
  float n2 = fbm(uv*2.6 - 7.0);
  float band = exp(-pow(d.y*2.2 + 0.3*sin(uv.x*2.0),2.0));
  vec3 col = vec3(0.012,0.01,0.025);
  col += vec3(0.25,0.08,0.35)*smoothstep(0.0,0.9,n1)*0.35*band;
  col += vec3(0.05,0.15,0.35)*smoothstep(0.1,1.0,n2)*0.35;
  col += vec3(0.4,0.25,0.15)*smoothstep(0.3,1.0,n1*n2*2.0)*0.2*band;
  gl_FragColor = vec4(col,1.0);
}
`;

export const starsVert = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
void main(){
  vColor = aColor;
  vec4 mv = modelViewMatrix*vec4(position,1.0);
  gl_Position = projectionMatrix*mv;
  float tw = 0.75 + 0.25*sin(uTime*2.0 + position.x*0.37 + position.y*0.11);
  gl_PointSize = aSize*uPixelRatio*tw;
}
`;
export const starsFrag = /* glsl */ `
varying vec3 vColor;
void main(){
  float d = length(gl_PointCoord-0.5);
  float a = smoothstep(0.5,0.0,d);
  gl_FragColor = vec4(vColor*a*a*1.6, 1.0);
}
`;

export const lensFrag = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uAspect;
uniform float uStrength;
uniform float uWhite;
varying vec2 vUv;
void main(){
  vec2 d = vUv - uCenter;
  d.x *= uAspect;
  float r = max(length(d), 1e-4);
  float rs = uRadius;
  float defl = uStrength * rs*rs / r;
  defl = min(defl, r*1.8 + rs*0.5);
  vec2 dir = d / r;
  vec2 off = dir*defl;
  off.x /= uAspect;
  vec2 suv = vUv - off;
  vec3 col = texture2D(tDiffuse, suv).rgb;
  // Einstein ring brightening
  float ring = exp(-pow((r - rs*sqrt(uStrength)*1.0)/(rs*0.25),2.0));
  col *= 1.0 + ring*0.6;
  // shadow of horizon (black hole mode)
  float shadow = smoothstep(rs*2.4, rs*2.7, r);
  col *= mix(shadow, 1.0, uWhite);
  gl_FragColor = vec4(col,1.0);
}
`;

export const lensVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }
`;
