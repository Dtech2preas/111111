import re

with open('js/ui/CanvasUI.js', 'r') as f:
    content = f.read()

# Make sure if isReadOnly, hit testing for interaction ignores things if we want them unselectable entirely, but they just shouldn't be movable. Since they can't be dragged anymore, that part is fine.
