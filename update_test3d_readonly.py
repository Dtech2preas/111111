import re

with open('js/test3d.js', 'r') as f:
    content = f.read()

old_readonly = """    if (urlParams.get('readonly') === 'true' || isGuest || isStudent) {
        const floorInputs = document.getElementById('floor-inputs');
        if (floorInputs) {
            floorInputs.style.display = 'none';
        }
    }"""
new_readonly = """    if (urlParams.get('readonly') === 'true' || isGuest || isStudent) {
        const floorInputs = document.getElementById('floor-inputs');
        if (floorInputs) {
            floorInputs.style.display = 'none';
        }
    }"""
content = content.replace(old_readonly, new_readonly)

with open('js/test3d.js', 'w') as f:
    f.write(content)
