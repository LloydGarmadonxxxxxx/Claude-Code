import bpy, math, os

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# Gold metallic torus knot-ish object: a torus + sphere
bpy.ops.mesh.primitive_torus_add(major_radius=1.2, minor_radius=0.35, location=(0, 0, 1.2))
torus = bpy.context.object
torus.rotation_euler = (math.radians(60), 0, math.radians(20))
bpy.ops.object.shade_smooth()

gold = bpy.data.materials.new("Gold")
gold.use_nodes = True
bsdf = gold.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (1.0, 0.72, 0.25, 1)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.22
torus.data.materials.append(gold)

# Floor
bpy.ops.mesh.primitive_plane_add(size=20)
floor = bpy.context.object
fm = bpy.data.materials.new("Floor")
fm.use_nodes = True
fm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.05, 0.05, 0.06, 1)
fm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.4
floor.data.materials.append(fm)

# Lights
bpy.ops.object.light_add(type='AREA', location=(3, -3, 5))
key = bpy.context.object
key.data.energy = 800
key.data.size = 3
key.rotation_euler = (math.radians(45), 0, math.radians(45))
bpy.ops.object.light_add(type='AREA', location=(-4, 2, 3))
rim = bpy.context.object
rim.data.energy = 400
rim.data.color = (0.5, 0.7, 1.0)
rim.rotation_euler = (math.radians(60), 0, math.radians(-120))

# World
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.01, 0.01, 0.015, 1)

# Camera
bpy.ops.object.camera_add(location=(0, -6, 2.6))
cam = bpy.context.object
cam.rotation_euler = (math.radians(78), 0, 0)
scene.camera = cam

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.resolution_x = 960
scene.render.resolution_y = 540
scene.render.filepath = os.path.join(os.getcwd(), "blender_test.png")
bpy.ops.render.render(write_still=True)
print("DONE", bpy.app.version_string)
