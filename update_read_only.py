with open('js/ui/CanvasUI.js', 'r') as f:
    content = f.read()

# Modify checkReadOnly to only hide the parts of sidebar-right that shouldn't be visible (like settings)
# but keep floor selection visible.
# Wait, actually we can just create a new floating UI for floor selection if readonly, or just selectively hide things in sidebar-right.
# Let's inspect sidebar-right contents.
