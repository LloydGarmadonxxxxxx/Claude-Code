// Five views of the same corridor, after the reference film. "auto" cycles them.
export const SCENES = [
  {
    id: 'specimen', name: '标本光框', en: 'SPECIMEN',
    fill(s, t) {
      s.cam.set(Math.sin(t * 0.07) * 0.25, 0.15, 9.4); s.look.set(0, 0.12, -8);
      s.group.pos.set(0, 0, 0); s.group.rotY = 0; s.group.scale = 1;
      Object.assign(s.op, { frames: 0.72, zoe: 1, lines: 0, gallery: 0, slab: 0, core: 0.85, dust: 0.8, bg: 1 });
      s.lightPos.set(0, 0, -66); s.cross = 0.3; s.coreSize = 50; s.rays = 0.55; s.fg = 0; s.lineFlow = 0;
    },
  },
  {
    id: 'echo', name: '回声光廊', en: 'ECHO CORRIDOR',
    fill(s, t) {
      s.cam.set(4.3 + Math.sin(t * 0.06) * 0.3, 0.85, 8.4); s.look.set(-0.9, 0, -16);
      s.group.pos.set(0, 0, 0); s.group.rotY = 0; s.group.scale = 1;
      Object.assign(s.op, { frames: 0.5, zoe: 1, lines: 0.55, gallery: 0, slab: 0, core: 1.2, dust: 0.5, bg: 0.6 });
      s.lightPos.set(0.4, 0, -66); s.cross = 1.15; s.coreSize = 90; s.rays = 1.3; s.fg = 0; s.lineFlow = 4;
    },
  },
  {
    id: 'return', name: '失焦回返', en: 'DRIFT',
    fill(s, t) {
      s.cam.set(Math.sin(t * 0.09) * 0.4, -0.15, 10.4); s.look.set(0, 0, -8);
      s.group.pos.set(0, 0, 0); s.group.rotY = 0; s.group.scale = 1;
      Object.assign(s.op, { frames: 0.72, zoe: 1, lines: 0, gallery: 0, slab: 0, core: 0.9, dust: 0.9, bg: 1 });
      s.lightPos.set(0.3, 0, -66); s.cross = 0.55; s.coreSize = 55; s.rays = 0.75; s.fg = 1; s.lineFlow = 0;
    },
  },
  {
    id: 'gallery', name: '蝴蝶长廊', en: 'GALLERY',
    fill(s, t) {
      s.cam.set(3.9, 0.35 + Math.sin(t * 0.08) * 0.15, 7.8); s.look.set(-0.6, 0, -26);
      s.group.pos.set(0, 0, 0); s.group.rotY = 0; s.group.scale = 1;
      Object.assign(s.op, { frames: 0.14, zoe: 1, lines: 0.15, gallery: 1, slab: 0, core: 1.0, dust: 0.6, bg: 0.8 });
      s.lightPos.set(0, -0.1, -70); s.cross = 0.7; s.coreSize = 60; s.rays = 1.0; s.fg = 0; s.lineFlow = 1;
    },
  },
  {
    id: 'rest', name: '玻璃栖息', en: 'GLASS REST',
    fill(s, t) {
      s.cam.set(0.4 + Math.sin(t * 0.05) * 0.3, 1.0, 7.2); s.look.set(0.9, 0.35, 0);
      // the corridor, seen from afar, becomes the little box of receding butterflies
      s.group.pos.set(2.6, 0.55, -1.4); s.group.rotY = -1.05; s.group.scale = 0.2;
      Object.assign(s.op, { frames: 0.8, zoe: 1, lines: 0, gallery: 0, slab: 1, core: 0.45, dust: 0.45, bg: 0.25 });
      s.lightPos.set(5.2, 0.6, -6); s.cross = 0.45; s.coreSize = 7; s.rays = 0.6; s.fg = 0; s.lineFlow = 0;
    },
  },
];
