import re

with open('js/ui/CanvasUI.js', 'r') as f:
    content = f.read()

# Add this.isReadOnly = false; in constructor
content = content.replace("this.touchTapTimeout = null;", "this.touchTapTimeout = null;\n        this.isReadOnly = false;")

# Set this.isReadOnly = true in checkReadOnly
content = content.replace("this.controller.setTool('select');", "this.controller.setTool('select');\n            this.isReadOnly = true;")

# In handleInputStart, prevent dragging if read only
old_handle_input_start = """        if (this.controller.currentTool === 'select') {
            // Check handles first
            this.activeHandle = this.hitTestHandle(pos);"""
new_handle_input_start = """        if (this.controller.currentTool === 'select') {
            // Check handles first
            this.activeHandle = this.hitTestHandle(pos);
            if(this.isReadOnly) {
                this.activeHandle = null;
            }"""
content = content.replace(old_handle_input_start, new_handle_input_start)

old_drag_check = """            if (hit) {
                this.isDragging = true;"""
new_drag_check = """            if (hit) {
                if (!this.isReadOnly) {
                    this.isDragging = true;
                }"""
content = content.replace(old_drag_check, new_drag_check)

with open('js/ui/CanvasUI.js', 'w') as f:
    f.write(content)
