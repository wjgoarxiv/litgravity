# lit-typographic-motion, the offline Blender rung. Blender runs this headless:
#   blender -b --factory-startup -P runner.py -- --scene scene.py --out DIR --width W --height H
#           --percent P --samples S --device METAL --fps F --seed N (--stills t,t,... | --frames 1-N)
# It sets up Cycles on the GPU (Metal on Apple silicon, else whatever GPU backend Blender finds, else
# the CPU, and the receipt says which), runs the film's scene.py with the `lit` helpers in scope, then
# renders either one still per listed time (still-01.png ...) or the frame sequence (000001.png ...),
# and writes receipt.json: the Blender version, engine, device, samples, size and the files written.
import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser(prog="runner.py")
    p.add_argument("--scene", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--width", type=int, required=True)
    p.add_argument("--height", type=int, required=True)
    p.add_argument("--percent", type=int, default=100)
    p.add_argument("--samples", type=int, default=128)
    p.add_argument("--device", default="METAL")
    p.add_argument("--fps", type=int, default=30)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--stills")
    p.add_argument("--frames")
    return p.parse_args(argv)


def use_gpu(scene, wanted):
    """Cycles on the wanted GPU backend when it has a device; another GPU backend next; the CPU last."""
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for backend in [wanted, "METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"]:
        try:
            prefs.compute_device_type = backend
        except TypeError:
            continue
        prefs.get_devices()
        gpus = [d for d in prefs.devices if d.type == backend]
        if gpus:
            for d in prefs.devices:
                d.use = d.type == backend
            scene.cycles.device = "GPU"
            return backend
    scene.cycles.device = "CPU"
    return "CPU"


class Lit:
    """Helpers the scene script may use. Times are in film seconds; the plate starts at frame 1."""

    def __init__(self, fps):
        self.fps = fps

    def frame(self, t):
        return int(round(t * self.fps)) + 1

    def key(self, obj, prop, t, value=None, index=-1):
        """Set obj.<prop> (when a value is given) and keyframe it at film time t."""
        if value is not None:
            setattr(obj, prop, value)
        obj.keyframe_insert(data_path=prop, frame=self.frame(t), index=index)

    def look_at(self, obj, target):
        direction = Vector(target) - obj.location
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    def material(self, name, color, roughness=0.4, metallic=0.0, emission=None, strength=0.0):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (*self.rgb(color), 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission is not None:
            bsdf.inputs["Emission Color"].default_value = (*self.rgb(emission), 1.0)
            bsdf.inputs["Emission Strength"].default_value = strength
        return mat

    def rgb(self, color):
        """A #RRGGBB colour in Blender's linear space."""
        if not isinstance(color, str):
            return tuple(color)[:3]
        h = color.lstrip("#")
        srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)

    def rounded_box(self, name, size, radius=0.08, segments=6, material=None, location=(0, 0, 0)):
        """A box with bevelled edges that catch the light."""
        bpy.ops.mesh.primitive_cube_add(size=1, location=location)
        obj = bpy.context.active_object
        obj.name = name
        obj.scale = size
        bpy.ops.object.transform_apply(scale=True)
        bevel = obj.modifiers.new("bevel", "BEVEL")
        bevel.width = radius
        bevel.segments = segments
        bevel.limit_method = "ANGLE"
        bpy.ops.object.shade_smooth()
        if material is not None:
            obj.data.materials.append(material)
        return obj

    def image_card(self, name, image_path, width=1.0, location=(0, 0, 0), emission=1.0):
        """A flat card showing an image file (a fetched product asset) at its own aspect ratio."""
        img = bpy.data.images.load(os.path.abspath(image_path))
        w, h = img.size
        bpy.ops.mesh.primitive_plane_add(size=1, location=location)
        obj = bpy.context.active_object
        obj.name = name
        obj.scale = (width, width * h / max(w, 1), 1)
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = img
        bsdf = nodes["Principled BSDF"]
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
        mat.node_tree.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        bsdf.inputs["Emission Strength"].default_value = emission
        obj.data.materials.append(mat)
        return obj

    def area_light(self, name, location, target=(0, 0, 0), power=400.0, size=2.0, color="#FFFFFF"):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = power
        data.size = size
        data.color = self.rgb(color)
        obj = bpy.data.objects.new(name, data)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = location
        self.look_at(obj, target)
        return obj

    def camera(self, location, target=(0, 0, 0), lens=50.0, dof=None):
        """The scene camera, aimed at target; dof=(focus_distance, f_stop) turns on depth of field."""
        data = bpy.data.cameras.new("camera")
        data.lens = lens
        if dof is not None:
            data.dof.use_dof = True
            data.dof.focus_distance, data.dof.aperture_fstop = dof
        obj = bpy.data.objects.new("camera", data)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = location
        self.look_at(obj, target)
        bpy.context.scene.camera = obj
        return obj

    def world(self, color, strength=1.0):
        world = bpy.context.scene.world or bpy.data.worlds.new("world")
        bpy.context.scene.world = world
        world.use_nodes = True
        bg = world.node_tree.nodes["Background"]
        bg.inputs["Color"].default_value = (*self.rgb(color), 1.0)
        bg.inputs["Strength"].default_value = strength
        return world


def main():
    a = parse()
    os.makedirs(a.out, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    device = use_gpu(scene, a.device)
    scene.cycles.samples = a.samples
    scene.cycles.seed = a.seed
    scene.cycles.use_denoising = True
    scene.render.resolution_x = a.width
    scene.render.resolution_y = a.height
    scene.render.resolution_percentage = a.percent
    scene.render.fps = a.fps
    scene.render.use_motion_blur = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"

    lit = Lit(a.fps)
    with open(a.scene, encoding="utf-8") as fh:
        code = compile(fh.read(), a.scene, "exec")
    exec(code, {"bpy": bpy, "lit": lit, "math": math, "Vector": Vector, "__name__": "__main__", "__file__": a.scene})
    if scene.camera is None:
        raise SystemExit("scene.py made no camera: call lit.camera(...) or set bpy.context.scene.camera")
    # The scene may raise its own settings; the command line has the last word on size and samples.
    scene.cycles.samples = a.samples
    scene.render.resolution_percentage = a.percent

    files = []
    if a.stills:
        for i, t in enumerate(float(x) for x in a.stills.split(",")):
            scene.frame_set(lit.frame(t))
            name = f"still-{i + 1:02d}.png"
            scene.render.filepath = os.path.join(a.out, name)
            bpy.ops.render.render(write_still=True)
            files.append(name)
    else:
        first, last = (int(x) for x in a.frames.split("-"))
        scene.frame_start, scene.frame_end = first, last
        scene.render.filepath = os.path.join(a.out, "######")
        bpy.ops.render.render(animation=True)
        files = [f"{f:06d}.png" for f in range(first, last + 1)]

    receipt = {
        "blender": bpy.app.version_string, "engine": "CYCLES", "device": device, "samples": a.samples,
        "percent": a.percent, "width": a.width * a.percent // 100, "height": a.height * a.percent // 100,
        "fps": a.fps, "files": [f for f in files if os.path.exists(os.path.join(a.out, f))],
    }
    with open(os.path.join(a.out, "receipt.json"), "w", encoding="utf-8") as fh:
        json.dump(receipt, fh)


main()
