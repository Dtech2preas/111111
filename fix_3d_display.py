import re

with open('js/test3d.js', 'r') as f:
    content = f.read()

# Make sure all floors are built initially
# They are built correctly in the getAllFloors promise:
#    for(let i=0; i<=maxFloor; i++) {
#        if (floors[i]) {
#            buildFloor(floors[i], i);
#        }
#    }

# Also ensure it defaults to not completely clear other floors, right now buildFloor clears only the current level.
# `if (floorGroups[level]) { wallsGroup.remove(floorGroups[level]); }`
