"""
雪景素材生成脚本：带积雪的松树（3 种）、圣诞树、原木小屋、路灯、栅栏。
运行：python3 snow_assets.py [输出目录]
输出：snow_assets.glb（以及可选的预览渲染 snow_preview.png，加参数 --preview）
"""
import bpy, bmesh, math, random, sys, os
from mathutils import Vector, noise

OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else '.')
PREVIEW = '--preview' in sys.argv
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- materials ----------
def mat(name, color, rough=0.8, metal=0.0, emit=None, emit_strength=0.0, vcol=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    if vcol:
        ca = nt.nodes.new("ShaderNodeVertexColor")
        ca.layer_name = "Col"
        nt.links.new(ca.outputs["Color"], b.inputs["Base Color"])
    return m

M = {
    'Foliage':    mat('Foliage', (1, 1, 1), 0.85, vcol=True),
    'Bark':       mat('Bark', (0.06, 0.035, 0.022), 0.95),
    'Snow':       mat('Snow', (0.82, 0.85, 0.9), 0.75),
    'Wood':       mat('Wood', (0.13, 0.065, 0.032), 0.85),
    'WoodDark':   mat('WoodDark', (0.05, 0.028, 0.016), 0.9),
    'Stone':      mat('Stone', (0.16, 0.15, 0.145), 0.95),
    'Metal':      mat('Metal', (0.02, 0.022, 0.025), 0.45, 0.85),
    'WindowGlow': mat('WindowGlow', (0.9, 0.55, 0.22), 0.4, emit=(1.0, 0.55, 0.2), emit_strength=3.0),
    'LampGlow':   mat('LampGlow', (1.0, 0.75, 0.4), 0.3, emit=(1.0, 0.72, 0.38), emit_strength=6.0),
    'Curtain':    mat('Curtain', (0.35, 0.05, 0.04), 0.9),
}

def link(obj, coll=None):
    (coll or scene.collection).objects.link(obj)
    return obj

def mesh_obj(name, verts, faces, material):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    link(ob)
    ob.data.materials.append(material)
    return ob

def smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    ob.name = name
    return ob

def prim(kind, name, material, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), **kw):
    getattr(bpy.ops.mesh, 'primitive_%s_add' % kind)(location=loc, rotation=rot, **kw)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    ob.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return ob

def lumpy(ob, amount=0.05, freq=2.0, seed=0, up_only=False):
    off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    for v in ob.data.vertices:
        w = ob.matrix_world @ v.co
        n = noise.noise(w * freq + off)
        d = v.normal * n * amount
        if up_only and v.normal.z < 0:
            d *= 0.2
        v.co += d

# ---------- pine tree ----------
def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def skirt(z_top, R, h, k, seed, snowiness):
    """一层带锯齿树枝的'裙摆'，上表面积雪，下表面深绿。返回 (verts, faces, colors)"""
    rnd = random.Random(seed)
    A, T = 96, 7
    phase = rnd.random() * 6.28
    verts, faces, cols = [], [], []
    GREEN = (0.012, 0.035, 0.016)
    GREEN2 = (0.02, 0.05, 0.022)
    DARK = (0.006, 0.016, 0.008)
    SNOW = (0.78, 0.81, 0.86)
    jag = []
    for a in range(A):
        th = a / A * math.tau
        j = 0.68 + 0.32 * abs(math.sin(k * th / 2 + phase)) ** 0.55 + rnd.uniform(-0.05, 0.05)
        jag.append(j)
    ring_top = []
    # top center
    verts.append((0, 0, z_top + 0.02)); cols.append(SNOW if snowiness > 0.2 else GREEN)
    top_c = 0
    for r_i in range(1, T + 1):
        t = r_i / T
        ring = []
        for a in range(A):
            th = a / A * math.tau
            j = jag[a]
            r = R * t * (1 - (1 - j) * t)
            z = z_top - h * t ** 1.35 - 0.18 * R * t ** 3 * (j - 0.6)
            p = Vector((r * math.cos(th), r * math.sin(th), z))
            nz = noise.noise(p * 2.3 + Vector((seed, 0, 0)))
            s = snowiness * (1.25 - 0.55 * t) - (j - 0.68) / 0.32 * 0.45 * t + nz * 0.55
            s = max(0.0, min(1.0, (s - 0.25) * 2.2))
            p.z += 0.05 * s
            g = lerp(GREEN, GREEN2, max(0, nz))
            ring.append(len(verts)); verts.append(tuple(p)); cols.append(lerp(g, SNOW, s))
        ring_top.append(ring)
    # bottom surface
    verts.append((0, 0, z_top - h * 0.45)); cols.append(DARK)
    bot_c = len(verts) - 1
    ring_bot = []
    for r_i in range(1, T):
        t = r_i / T
        ring = []
        for a in range(A):
            x, y, z = verts[ring_top[r_i - 1][a]]
            ring.append(len(verts)); verts.append((x * 0.97, y * 0.97, z - h * 0.45 * (1 - t) ** 0.8)); cols.append(DARK)
        ring_bot.append(ring)
    ring_bot.append(ring_top[-1])
    for a in range(A):
        b = (a + 1) % A
        faces.append((top_c, ring_top[0][a], ring_top[0][b]))
        faces.append((bot_c, ring_bot[0][b], ring_bot[0][a]))
        for r in range(T - 1):
            faces.append((ring_top[r][a], ring_top[r + 1][a], ring_top[r + 1][b], ring_top[r][b]))
            faces.append((ring_bot[r][a], ring_bot[r][b], ring_bot[r + 1][b], ring_bot[r + 1][a]))
    return verts, faces, cols

def pine(name, H=6.0, R=2.0, tiers=8, seed=1, snowiness=1.0):
    rnd = random.Random(seed)
    V, F, C = [], [], []
    z0 = H * 0.13
    for i in range(tiers):
        f = i / (tiers - 1)            # 0 = bottom, 1 = top
        z_top = z0 + (H - z0) * (0.22 + 0.78 * f) ** 1.0
        r = R * (1 - f) ** 0.95 * rnd.uniform(0.9, 1.05) + 0.18
        h = (H - z0) / tiers * 2.0
        v, fc, c = skirt(z_top, r, h, rnd.randint(9, 15), seed * 31 + i, snowiness * (0.75 + 0.35 * (1 - f)))
        off = len(V)
        V += v; C += c
        F += [tuple(x + off for x in face) for face in fc]
    ob = mesh_obj(name, V, F, M['Foliage'])
    smooth(ob)
    attr = ob.data.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    for i, c in enumerate(C):
        attr.data[i].color = (*c, 1)
    ob.data.color_attributes.active_color = attr
    trunk = prim('cylinder', name + '_trunk', M['Bark'], loc=(0, 0, H * 0.25), vertices=10,
                 radius=R * 0.07 + 0.05, depth=H * 0.5)
    for v in trunk.data.vertices:
        if v.co.z > 0:
            v.co.x *= 0.6; v.co.y *= 0.6
    return join([ob, trunk], name)

# ---------- log cabin ----------
def cabin():
    parts = []
    W, D, Hw, r = 6.0, 4.6, 2.8, 0.15
    n = int(Hw / (r * 1.85))
    for i in range(n):
        z = r + i * r * 1.85
        odd = i % 2
        for side in (-1, 1):
            # along x (front/back)
            if odd == 0:
                c = prim('cylinder', 'log', M['Wood'], loc=(0, side * D / 2, z), rot=(0, math.pi / 2, 0),
                         vertices=14, radius=r * random.uniform(0.95, 1.05), depth=W + 0.7)
            else:
                c = prim('cylinder', 'log', M['Wood'], loc=(side * W / 2, 0, z), rot=(math.pi / 2, 0, 0),
                         vertices=14, radius=r * random.uniform(0.95, 1.05), depth=D + 0.7)
            parts.append(c)
        # the other pair slightly offset in z so the corners interlock
        for side in (-1, 1):
            if odd == 0:
                c = prim('cylinder', 'log', M['Wood'], loc=(side * W / 2, 0, z + r * 0.92), rot=(math.pi / 2, 0, 0),
                         vertices=14, radius=r, depth=D + 0.7)
            else:
                c = prim('cylinder', 'log', M['Wood'], loc=(0, side * D / 2, z + r * 0.92), rot=(0, math.pi / 2, 0),
                         vertices=14, radius=r, depth=W + 0.7)
            parts.append(c)
    for p in parts:
        smooth(p)
    top = n * r * 1.85 + r
    pitch = math.radians(34)
    half = D / 2 + 0.55
    L = half / math.cos(pitch)
    ridge = top + (D / 2) * math.tan(pitch)
    # gables
    for side in (-1, 1):
        x = side * (W / 2)
        v = [(x - 0.15, -D / 2 - 0.1, top), (x - 0.15, D / 2 + 0.1, top), (x - 0.15, 0, ridge),
             (x + 0.15, -D / 2 - 0.1, top), (x + 0.15, D / 2 + 0.1, top), (x + 0.15, 0, ridge)]
        g = mesh_obj('gable', v, [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)], M['WoodDark'])
        parts.append(g)
    roof_parts, snow_parts = [], []
    for side in (-1, 1):
        cy = side * half / 2
        cz = ridge - (half / 2) * math.tan(pitch) + 0.12
        rf = prim('cube', 'roof', M['WoodDark'], loc=(0, cy, cz), rot=(-side * pitch, 0, 0),
                  scale=(W / 2 + 0.8, L / 2, 0.09))
        roof_parts.append(rf)
        # snow slab on top: bevelled + lumpy, slightly overhanging
        nrm = Vector((0, side * math.sin(pitch), math.cos(pitch)))
        sc = Vector((0, cy, cz)) + nrm * 0.24
        sn = prim('cube', 'roof_snow', M['Snow'], loc=tuple(sc), rot=(-side * pitch, 0, 0),
                  scale=(W / 2 + 0.88, L / 2 + 0.06, 0.16))
        bpy.context.view_layer.objects.active = sn
        mod = sn.modifiers.new('bev', 'BEVEL'); mod.width = 0.14; mod.segments = 4
        sub = sn.modifiers.new('sub', 'SUBSURF'); sub.levels = 2
        bpy.ops.object.modifier_apply(modifier='bev')
        bpy.ops.object.modifier_apply(modifier='sub')
        lumpy(sn, 0.07, 1.3, seed=side + 5, up_only=True)
        smooth(sn)
        snow_parts.append(sn)
    # chimney
    ch = prim('cube', 'chimney', M['Stone'], loc=(W / 2 - 1.1, 0.9, ridge + 0.2), scale=(0.38, 0.38, 1.2))
    lumpy(ch, 0.02, 6, seed=3)
    chs = prim('uv_sphere', 'chimney_snow', M['Snow'], loc=(W / 2 - 1.1, 0.9, ridge + 1.42), scale=(0.5, 0.5, 0.16),
               segments=20, ring_count=10)
    lumpy(chs, 0.04, 3, seed=9); smooth(chs)
    parts += [ch, chs]
    # windows (front = -Y)
    for wx in (-1.6, 1.6):
        fr = prim('cube', 'window_frame', M['WoodDark'], loc=(wx, -D / 2 - 0.16, 1.55), scale=(0.62, 0.06, 0.55))
        gl = prim('plane', 'window_glass', M['WindowGlow'], loc=(wx, -D / 2 - 0.225, 1.55), rot=(math.pi / 2, 0, 0),
                  scale=(0.52, 0.45, 1))
        mull = prim('cube', 'mullion', M['WoodDark'], loc=(wx, -D / 2 - 0.235, 1.55), scale=(0.03, 0.02, 0.45))
        mull2 = prim('cube', 'mullion', M['WoodDark'], loc=(wx, -D / 2 - 0.235, 1.55), scale=(0.52, 0.02, 0.03))
        cu = prim('cube', 'curtain', M['Curtain'], loc=(wx - 0.38, -D / 2 - 0.2, 1.6), scale=(0.12, 0.01, 0.4))
        sill = prim('cube', 'sill', M['WoodDark'], loc=(wx, -D / 2 - 0.3, 0.95), scale=(0.72, 0.16, 0.05))
        sills = prim('uv_sphere', 'sill_snow', M['Snow'], loc=(wx, -D / 2 - 0.3, 1.02), scale=(0.72, 0.17, 0.06),
                     segments=16, ring_count=8)
        lumpy(sills, 0.02, 4, seed=int(wx * 10)); smooth(sills)
        parts += [fr, gl, mull, mull2, cu, sill, sills]
    door = prim('cube', 'door', M['WoodDark'], loc=(0, -D / 2 - 0.17, 1.05), scale=(0.55, 0.05, 1.05))
    dglow = prim('plane', 'door_glow', M['WindowGlow'], loc=(0, -D / 2 - 0.225, 1.75), rot=(math.pi / 2, 0, 0),
                 scale=(0.28, 0.12, 1))
    knob = prim('uv_sphere', 'knob', M['Metal'], loc=(0.38, -D / 2 - 0.24, 1.0), radius=0.045, segments=10, ring_count=6)
    step = prim('cube', 'step', M['Stone'], loc=(0, -D / 2 - 0.65, 0.1), scale=(0.9, 0.35, 0.12))
    parts += [door, dglow, knob, step]
    # snow drifts hugging the walls
    random.seed(4)
    for i in range(16):
        side = random.choice(['x', 'y'])
        if side == 'y':
            x = random.uniform(-W / 2, W / 2); y = random.choice((-1, 1)) * (D / 2 + 0.25)
            if abs(x) < 0.9 and y < 0:
                continue
        else:
            x = random.choice((-1, 1)) * (W / 2 + 0.25); y = random.uniform(-D / 2, D / 2)
        d = prim('uv_sphere', 'drift', M['Snow'], loc=(x, y, 0), scale=(random.uniform(0.8, 1.5), random.uniform(0.6, 1.0),
                 random.uniform(0.35, 0.6)), segments=18, ring_count=9)
        lumpy(d, 0.06, 2, seed=i); smooth(d)
        parts.append(d)
    ob = join(parts + roof_parts + snow_parts, 'cabin')
    return ob

# ---------- lamp post ----------
def lamp():
    p = []
    p.append(prim('cylinder', 'base', M['Metal'], loc=(0, 0, 0.25), vertices=16, radius=0.16, depth=0.5))
    p.append(prim('cylinder', 'pole', M['Metal'], loc=(0, 0, 1.75), vertices=12, radius=0.055, depth=3.0))
    p.append(prim('cylinder', 'collar', M['Metal'], loc=(0, 0, 3.22), vertices=12, radius=0.1, depth=0.08))
    p.append(prim('cube', 'glass', M['LampGlow'], loc=(0, 0, 3.5), scale=(0.17, 0.17, 0.24)))
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(prim('cube', 'bar', M['Metal'], loc=(sx * 0.18, sy * 0.18, 3.5), scale=(0.018, 0.018, 0.26)))
    cap = prim('cone', 'cap', M['Metal'], loc=(0, 0, 3.86), vertices=4, radius1=0.33, depth=0.24, rot=(0, 0, math.pi / 4))
    p.append(cap)
    s = prim('uv_sphere', 'cap_snow', M['Snow'], loc=(0, 0, 3.92), scale=(0.25, 0.25, 0.1), segments=16, ring_count=8)
    lumpy(s, 0.02, 5, seed=2); smooth(s)
    p.append(s)
    p.append(prim('uv_sphere', 'finial', M['Metal'], loc=(0, 0, 4.03), radius=0.04, segments=10, ring_count=6))
    for o in p[:3]:
        smooth(o)
    return join(p, 'lamp')

# ---------- fence ----------
def fence():
    p = []
    for x in (-1.2, 1.2):
        p.append(prim('cube', 'post', M['Wood'], loc=(x, 0, 0.55), scale=(0.07, 0.07, 0.55)))
        s = prim('uv_sphere', 'post_snow', M['Snow'], loc=(x, 0, 1.13), scale=(0.11, 0.11, 0.07), segments=12, ring_count=6)
        p.append(s)
    for z in (0.45, 0.85):
        p.append(prim('cube', 'rail', M['Wood'], loc=(0, 0, z), scale=(1.3, 0.035, 0.06)))
        s = prim('cube', 'rail_snow', M['Snow'], loc=(0, 0, z + 0.085), scale=(1.28, 0.05, 0.035))
        bpy.context.view_layer.objects.active = s
        m = s.modifiers.new('sub', 'SUBSURF'); m.levels = 2
        bpy.ops.object.modifier_apply(modifier='sub')
        lumpy(s, 0.02, 4, seed=int(z * 10), up_only=True); smooth(s)
        p.append(s)
    return join(p, 'fence')

# ---------- build ----------
objs = [
    pine('pine_a', H=7.0, R=2.1, tiers=9, seed=1, snowiness=1.0),
    pine('pine_b', H=5.2, R=1.8, tiers=7, seed=2, snowiness=1.1),
    pine('pine_c', H=9.0, R=2.4, tiers=11, seed=3, snowiness=0.9),
    pine('xmas_tree', H=5.0, R=1.9, tiers=8, seed=7, snowiness=0.45),
    cabin(), lamp(), fence(),
]
for i, o in enumerate(objs):
    o.location = (0, 0, 0)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'snow_assets.glb'), export_format='GLB',
                          use_selection=True, export_apply=True, export_vertex_color='ACTIVE',
                          export_all_vertex_colors=False)
# 同时导出一份内嵌 glTF（纯 JSON），用于不支持 .glb 的托管环境
import json, struct, base64
with open(os.path.join(OUT, 'snow_assets.glb'), 'rb') as f:
    data = f.read()
jlen = struct.unpack_from('<I', data, 12)[0]
gj = json.loads(data[20:20 + jlen])
blen = struct.unpack_from('<I', data, 20 + jlen)[0]
binc = data[28 + jlen:28 + jlen + blen]
gj['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(binc).decode()
with open(os.path.join(OUT, 'snow_assets.gltf.json'), 'w') as f:
    json.dump(gj, f, separators=(',', ':'))
print('EXPORTED', os.path.join(OUT, 'snow_assets.glb'))

if PREVIEW:
    xs = [-12, -6, 0, 5, 12, 17, 20]
    for o, x in zip(objs, xs):
        o.location = (x, 0, 0)
    bpy.ops.mesh.primitive_plane_add(size=80)
    bpy.context.object.data.materials.append(M['Snow'])
    w = bpy.data.worlds.new('W'); scene.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.45, 0.5, 0.6, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), 0, math.radians(30)))
    bpy.context.object.data.energy = 2.5
    PX, PY = (14, 14) if '--cabin' in sys.argv else (4, 30)
    bpy.ops.object.camera_add(location=(PX, -PY, 5), rotation=(math.radians(82), 0, 0))
    scene.camera = bpy.context.object
    scene.camera.data.lens = 28
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1280, 480
    scene.render.filepath = os.path.join(OUT, 'snow_preview.png')
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', scene.render.filepath)
