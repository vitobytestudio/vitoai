"""Launcher for every Blender job in this repo.

`import bpy` on its own dies with "undefined symbol: _ZN32pxr...UsdHydraTokensE"
even though that symbol is defined in bpy/lib/libusd_ms.so — the module is pulled in
RTLD_LOCAL, so its data relocations are not in the global scope yet when bpy is
relocated. Loading libusd first, RTLD_GLOBAL, fixes it. Nothing else about the scene
changes, so all the render scripts run through here:

    LD_LIBRARY_PATH=/tmp/vitobl/lib /tmp/vitobl/bin/python \\
        studio/blender/bpyrun.py studio/blender/scene_hero.py --out /tmp/hero3d
"""
import ctypes
import os
import runpy
import sys

def _libusd():
    import site
    paths = list(site.getsitepackages())
    try:
        paths.append(site.getusersitepackages())
    except Exception:
        pass
    paths.append(os.path.join(sys.prefix, "lib",
                              "python%d.%d" % sys.version_info[:2], "site-packages"))
    for sp in paths:
        p = os.path.join(sp, "bpy", "lib", "libusd_ms.so")
        if os.path.exists(p):
            return p
    return None


_p = _libusd()
if _p:
    try:
        ctypes.CDLL(_p, mode=ctypes.RTLD_GLOBAL)
    except OSError as e:                      # already loadable — fine
        print("bpyrun: preloaded libusd skipped:", str(e)[:90], file=sys.stderr)

target = sys.argv[1]
sys.argv = sys.argv[1:]
runpy.run_path(target, run_name="__main__")
