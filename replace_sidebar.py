import re

with open('js/ui/CanvasUI.js', 'r') as f:
    content = f.read()

# We need to change how checkReadOnly works.
# Instead of hiding sidebar-right entirely, we hide its specific sections and maybe float the floor controls.
old_check_readonly = """    checkReadOnly() {
        const urlParams = new URLSearchParams(window.location.search);
        const isGuest = localStorage.getItem('dtech_guest_mode') === 'true';
        const isStudent = localStorage.getItem('dtech_user_role') === 'student';
        if (urlParams.get('readonly') === 'true' || isGuest || isStudent) {
            const toolbar = document.querySelector('.toolbar-global');
            if (toolbar) toolbar.style.display = 'none';

            const sidebarLeft = document.getElementById('sidebar-left');
            if (sidebarLeft) sidebarLeft.style.display = 'none';

            const sidebarRight = document.getElementById('sidebar-right');
            if (sidebarRight) sidebarRight.style.display = 'none';

            // Reset tools
            this.controller.setTool('select');
            this.isReadOnly = true;

            // Re-adjust canvas width since sidebars are gone
            setTimeout(() => this.resize(), 100);
        }
    }"""
new_check_readonly = """    checkReadOnly() {
        const urlParams = new URLSearchParams(window.location.search);
        const isGuest = localStorage.getItem('dtech_guest_mode') === 'true';
        const isStudent = localStorage.getItem('dtech_user_role') === 'student';
        if (urlParams.get('readonly') === 'true' || isGuest || isStudent) {
            const toolbar = document.querySelector('.toolbar-global');
            if (toolbar) toolbar.style.display = 'none';

            const sidebarLeft = document.getElementById('sidebar-left');
            if (sidebarLeft) sidebarLeft.style.display = 'none';

            // Make sidebar right float or just keep it but hide everything except floor selector
            const sidebarRight = document.getElementById('sidebar-right');
            if (sidebarRight) {
                // Keep it visible, but style it for read-only
                const children = sidebarRight.children;
                for (let i = 0; i < children.length; i++) {
                    const child = children[i];
                    // Keep the Floors h3 and the floor controls
                    if (child.tagName === 'H3' && child.textContent === 'Floors') {
                        continue;
                    }
                    if (child.classList.contains('settings-group') && child.querySelector('#btn-floor-down')) {
                        // Hide the outline checkbox but keep the floor buttons
                        const outlineContainer = child.querySelector('#use-outline-container');
                        if (outlineContainer) outlineContainer.style.display = 'none';
                        continue;
                    }
                    // Hide everything else
                    child.style.display = 'none';
                }

                // Add some styling to make it look like a floating widget
                sidebarRight.style.position = 'absolute';
                sidebarRight.style.top = '10px';
                sidebarRight.style.right = '10px';
                sidebarRight.style.width = '200px';
                sidebarRight.style.height = 'auto';
                sidebarRight.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                sidebarRight.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                sidebarRight.style.borderRadius = '8px';
                sidebarRight.style.padding = '15px';
                sidebarRight.style.zIndex = '1000';
            }

            // Reset tools
            this.controller.setTool('select');
            this.isReadOnly = true;

            // Re-adjust canvas width since sidebars are functionally gone from flow
            setTimeout(() => this.resize(), 100);
        }
    }"""
content = content.replace(old_check_readonly, new_check_readonly)

with open('js/ui/CanvasUI.js', 'w') as f:
    f.write(content)
