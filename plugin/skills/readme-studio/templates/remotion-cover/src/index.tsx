import React from 'react';
import {AbsoluteFill, Composition, Easing, Img, interpolate, registerRoot, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

type CoverProps = {dark: boolean; mobile: boolean; blur: number; grain: number; expressive: boolean};

const Cover: React.FC<CoverProps> = ({dark, mobile, blur, grain, expressive}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const phase = frame / (durationInFrames - 1);
  const entry = interpolate(frame, [0, 24, 265, 299], [0, 1, 1, 0], {easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const ink = dark ? 'light' : 'dark';
  const paper = dark ? '#18272b' : '#f5f3eb';
  const color = dark ? '#f5f3eb' : '#18272b';
  const pad = mobile ? 54 : 80;
  return <AbsoluteFill style={{background: paper, overflow: 'hidden'}}>
    <Img className="depth-far" src={staticFile('background.png')} style={{position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', filter: `blur(${Math.max(10, blur + 8)}px)`, transform: `scale(${1.08 + Math.sin(phase * Math.PI * 2) * 0.008})`}}/>
    <Img className="depth-mid" src={staticFile('background.png')} style={{position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', clipPath: 'inset(8% 8% 18% 26% round 40px)', filter: `blur(${Math.max(3, blur + 1)}px)`, opacity: 0.56, transform: `scale(${1.04 + Math.sin(phase * Math.PI * 2) * 0.008})`}}/>
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 85% 12%, transparent, ${paper}b0 85%)`}}/>
    <div style={{position: 'absolute', width: mobile ? 600 : 900, height: 700, borderRadius: '50%', right: -250, top: -220, background: dark ? '#b7d8c733' : '#fff9d766', filter: 'blur(80px)', transform: `translateY(${Math.sin(phase*Math.PI*2)*(expressive ? 30 : 12)}px)`}}/>
    <svg width="100%" height="100%" style={{position: 'absolute', opacity: grain}}><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="19" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#grain)"/></svg>
    <div className="rim-light" data-light-zone="open-background" aria-hidden="true" style={{position: 'absolute', zIndex: 4, left: mobile ? pad + 56 : 1060, right: mobile ? pad + 56 : 80, top: mobile ? 20 : 48, height: mobile ? 56 : 200, borderRadius: '50%', background: 'radial-gradient(ellipse at 54% 42%, rgba(255,242,190,.6) 0%, rgba(255,242,190,.28) 38%, rgba(255,242,190,0) 76%)', filter: `blur(${mobile ? 10 : 14}px)`, opacity: 0.9, transform: mobile ? 'none' : 'rotate(-12deg)', pointerEvents: 'none'}}/>
    <div className="foreground-plane" style={{position: 'absolute', zIndex: 5, left: pad, right: mobile ? pad : 580, top: mobile ? 100 : 145, padding: mobile ? 30 : 42, background: paper, border: `1px solid ${color}55`, transform: `translateY(${(1-entry)*16}px)`}}>
      <Img src={staticFile(`label-${ink}.svg`)} style={{display: 'block', width: '58%', maxHeight: 40, objectFit: 'contain', objectPosition: 'left'}}/>
      <Img src={staticFile(`title-${ink}.svg`)} style={{display: 'block', width: '100%', marginTop: 36}}/>
      <div style={{width: 64, height: 5, background: '#c64d2e', margin: '28px 0'}}/>
      <Img src={staticFile(`subtitle-${ink}.svg`)} style={{display: 'block', width: '90%'}}/>
    </div>
    <svg className="foreground-plane" viewBox="0 0 20 20" shapeRendering="crispEdges" style={{position: 'absolute', zIndex: 6, width: mobile ? 300 : 400, right: mobile ? 80 : 100, bottom: mobile ? 65 : 125, transform: `translateY(${-8*Math.sin(phase*Math.PI*2)}px)`}} aria-label="Original pixel notebook motif">
      <path fill={paper} d="M3 1h12v2h2v15H3z"/><path fill={color} d="M3 1h12v2H5v13h10V3h2v15H3zM7 5h6v1H7zM7 8h6v1H7zM7 11h4v1H7z"/><path fill="#c64d2e" d="M1 4h4v2H1zM1 9h4v2H1zM1 14h4v2H1zM13 13h5v2h-5z"/>
    </svg>
    <div style={{position: 'absolute', left: pad, right: pad, bottom: 40, borderTop: `1px solid ${color}88`}}/>
  </AbsoluteFill>;
};

const Root = () => <>{[false,true].flatMap(mobile => [false,true].map(dark => <Composition key={`${mobile}-${dark}`} id={`Cover${mobile ? 'Mobile' : 'Wide'}${dark ? 'Dark' : 'Light'}`} component={Cover} width={mobile ? 800 : 1600} height={mobile ? 1000 : 800} fps={60} durationInFrames={300} defaultProps={{dark,mobile,blur:2,grain:0.06,expressive:false}}/>))}</>;
registerRoot(Root);
