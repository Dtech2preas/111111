import re

with open('js/test3d.js', 'r') as f:
    content = f.read()

# Make it listen to floor changes, but since FirebaseStorageManager.listenToFloorPlan only listens to ONE floor,
# if we change targetFloorLevel, we need to resubscribe.
# Looking at test3d.js: `let targetFloorLevel = 0;` and there is `window.FirebaseStorageManager.listenToFloorPlan(residenceId, targetFloorLevel, (data) => { ... })` which gets called ONCE inside `setTimeout`.

old_listen = """                // Now setup listeners for changes (simple approach: just listen to current target floor for updates)
                window.FirebaseStorageManager.listenToFloorPlan(residenceId, targetFloorLevel, (data) => {
                    latestFloorData = data;
                    buildFloor(data, targetFloorLevel);
                });"""
new_listen = """                // We should listen to all floors if possible, or re-subscribe when targetFloorLevel changes.
                // For a multi-floor 3D view, it's actually better to listen to the specific floor or just rebuild everything from scratch.
                // Let's implement a dynamic listener.
                let unsubscribeFloor = null;
                const setupFloorListener = (level) => {
                    if (unsubscribeFloor) unsubscribeFloor();
                    unsubscribeFloor = window.FirebaseStorageManager.listenToFloorPlan(residenceId, level, (data) => {
                        latestFloorData = data;
                        buildFloor(data, level);
                    });
                };
                setupFloorListener(targetFloorLevel);

                // Expose a way to update listener when floor changes
                window.updateFloorListener = setupFloorListener;"""
content = content.replace(old_listen, new_listen)

# Also update increase/decrease floor buttons to call updateFloorListener
content = content.replace(
    "orbitControls.target.set(p.x, targetFloorLevel * floorHeight, p.z);\n            orbitControls.update();",
    "orbitControls.target.set(p.x, targetFloorLevel * floorHeight, p.z);\n            orbitControls.update();\n            if (window.updateFloorListener) window.updateFloorListener(targetFloorLevel);"
)
content = content.replace(
    "orbitControls.target.set(p.x, targetFloorLevel * floorHeight, p.z);\n        orbitControls.update();",
    "orbitControls.target.set(p.x, targetFloorLevel * floorHeight, p.z);\n        orbitControls.update();\n        if (window.updateFloorListener) window.updateFloorListener(targetFloorLevel);"
)


with open('js/test3d.js', 'w') as f:
    f.write(content)
