with open('js/test3d.js', 'r') as f:
    content = f.read()

# Replace readonly check to hide specific components, not floor selection completely
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
# Already behaves like this, but let's double check what inputs are in test3d.html
