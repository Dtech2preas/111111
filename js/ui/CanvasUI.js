class CanvasUI {
    constructor(controller, canvasId) {
        this.controller = controller;
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.container = this.canvas.parentElement;

        // Viewport state
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;

        // Interaction state
        this.isDragging = false;
        this.isPanning = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Drawing state
        this.tempWallStart = null;
        this.currentMousePos = null;

        this.initCanvas();
        this.bindEvents();
        this.bindDOM();
        this.render();
    }

    initCanvas() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        // Center pan initially
        this.panX = this.canvas.width / 2;
        this.panY = this.canvas.height / 2;
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.render();
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        return {
            x: (x - this.panX) / this.zoom,
            y: (y - this.panY) / this.zoom
        };
    }

    bindEvents() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this));

        this.controller.on('model_changed', () => this.render());
        this.controller.on('selection_changed', () => this.updatePropertiesPanel());
    }

    bindDOM() {
        // Tools
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                const tool = e.target.dataset.tool;
                if (tool === 'delete') {
                    this.controller.deleteSelected();
                    // Don't keep delete active, revert to select
                    setTimeout(() => {
                        document.querySelector('[data-tool="select"]').click();
                    }, 100);
                } else {
                    this.controller.setTool(tool);
                }
            });
        });

        // Global Toolbar
        document.getElementById('btn-new').addEventListener('click', () => {
            if(confirm("Create new plan? Unsaved changes will be lost.")) {
                this.controller.model.reset();
                this.controller.history = [];
                this.controller.historyIndex = -1;
                this.controller.saveState();
                this.panX = this.canvas.width / 2;
                this.panY = this.canvas.height / 2;
                this.zoom = 1;
                this.updateZoomDisplay();
            }
        });

        document.getElementById('btn-save').addEventListener('click', () => {
            if (this.controller.saveLocal()) {
                document.getElementById('status-bar').innerText = "Saved to local storage.";
                setTimeout(() => document.getElementById('status-bar').innerText = "Ready", 3000);
            }
        });

        document.getElementById('btn-load').addEventListener('click', () => {
            if (this.controller.loadLocal()) {
                document.getElementById('status-bar').innerText = "Loaded from local storage.";
                setTimeout(() => document.getElementById('status-bar').innerText = "Ready", 3000);
            }
        });

        document.getElementById('btn-export-json').addEventListener('click', () => {
            this.controller.exportJSON();
        });

        document.getElementById('btn-export-pdf').addEventListener('click', () => {
             // Exporter hook
             if (window.PDFExporter) {
                 window.PDFExporter.export(this.controller.model, this.canvas);
             } else {
                 alert("PDF Exporter not available.");
             }
        });

        // Import JSON
        const btnImport = document.getElementById('btn-import');
        btnImport.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            input.onchange = e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = e => {
                    if (this.controller.model.load(e.target.result)) {
                        this.controller.history = [];
                        this.controller.historyIndex = -1;
                        this.controller.saveState();
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        });

        // Undo / Redo
        const btnUndo = document.getElementById('btn-undo');
        const btnRedo = document.getElementById('btn-redo');

        btnUndo.addEventListener('click', () => this.controller.undo());
        btnRedo.addEventListener('click', () => this.controller.redo());

        this.controller.on('history_changed', ({canUndo, canRedo}) => {
            btnUndo.disabled = !canUndo;
            btnRedo.disabled = !canRedo;
        });

        // Zoom Controls
        document.getElementById('btn-zoom-in').addEventListener('click', () => this.setZoom(this.zoom * 1.2));
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.setZoom(this.zoom / 1.2));
        document.getElementById('btn-zoom-reset').addEventListener('click', () => {
            this.zoom = 1;
            this.panX = this.canvas.width / 2;
            this.panY = this.canvas.height / 2;
            this.updateZoomDisplay();
            this.render();
        });

        // Settings
        document.getElementById('input-scale').addEventListener('change', (e) => {
            this.controller.setScale(parseFloat(e.target.value));
            this.render();
        });
    }

    setZoom(newZoom) {
        // Keep center
        const center = this.getMousePos({clientX: this.canvas.width/2 + this.canvas.getBoundingClientRect().left, clientY: this.canvas.height/2 + this.canvas.getBoundingClientRect().top});
        this.zoom = Math.max(0.1, Math.min(5, newZoom));

        this.panX = this.canvas.width/2 - center.x * this.zoom;
        this.panY = this.canvas.height/2 - center.y * this.zoom;

        this.updateZoomDisplay();
        this.render();
    }

    updateZoomDisplay() {
        document.getElementById('zoom-level').innerText = `${Math.round(this.zoom * 100)}%`;
    }

    // --- Mouse Interactions ---

    onMouseDown(e) {
        if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle click or Alt+Click for pan
            this.isPanning = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        if (e.button !== 0) return;

        const pos = this.getMousePos(e);
        const snappedPos = GeometryEngine.snapPoint(pos, this.controller.model.data.walls);

        if (this.controller.currentTool === 'select') {
            const hit = this.hitTest(pos);
            this.controller.selectElement(hit ? hit.id : null);
            if (hit) {
                this.isDragging = true;
                this.lastMouseX = pos.x;
                this.lastMouseY = pos.y;
            }
        }
        else if (this.controller.currentTool === 'wall') {
            if (!this.tempWallStart) {
                this.tempWallStart = snappedPos;
                this.currentMousePos = snappedPos;
            } else {
                // End wall
                this.controller.addWall(this.tempWallStart, snappedPos);
                this.tempWallStart = snappedPos; // Start next wall from here
            }
        }
        else if (this.controller.currentTool === 'door' || this.controller.currentTool === 'window') {
            const hit = this.hitTest(pos, ['wall']);
            if (hit) {
                // Simple implementation: place at exact pos on wall
                if (this.controller.currentTool === 'door') {
                    this.controller.addDoorToWall(hit.id, pos);
                } else {
                    this.controller.addWindowToWall(hit.id, pos);
                }
            }
        }
    }

    onMouseMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;
            this.panX += dx;
            this.panY += dy;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.render();
            return;
        }

        const pos = this.getMousePos(e);
        this.currentMousePos = pos;

        // Update coords display
        document.getElementById('coordinates').innerText = `X: ${Math.round(pos.x)}, Y: ${Math.round(pos.y)}`;

        if (this.isDragging && this.controller.selectedElementId) {
            const dx = pos.x - this.lastMouseX;
            const dy = pos.y - this.lastMouseY;

            const el = this.controller.model.getElementById(this.controller.selectedElementId);
            if (el && el.type === 'wall') {
                this.controller.model.updateWall(el.id, {
                    start: { x: el.start.x + dx, y: el.start.y + dy },
                    end: { x: el.end.x + dx, y: el.end.y + dy }
                });
            } else if (el && (el.type === 'door' || el.type === 'window')) {
                // Moving doors/windows (simplified, just free move)
                el.position.x += dx;
                el.position.y += dy;
                this.controller.model.emit('change');
            }

            this.lastMouseX = pos.x;
            this.lastMouseY = pos.y;
        }

        if (this.controller.currentTool === 'wall' && this.tempWallStart) {
            this.render(); // Re-render to show temp wall
        }
    }

    onMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'default';
        }

        if (this.isDragging) {
            this.isDragging = false;
            this.controller.commitAction(); // Save state after drag ends
        }

        // Right click cancels wall drawing
        if (e.button === 2 && this.controller.currentTool === 'wall') {
            this.tempWallStart = null;
            this.render();
        }
    }

    onWheel(e) {
        e.preventDefault();
        const zoomFactor = 1.1;
        const mousePos = this.getMousePos(e);

        if (e.deltaY < 0) {
            this.zoom *= zoomFactor;
        } else {
            this.zoom /= zoomFactor;
        }

        this.zoom = Math.max(0.1, Math.min(5, this.zoom));

        // Adjust pan to zoom around mouse cursor
        this.panX = e.clientX - this.canvas.getBoundingClientRect().left - mousePos.x * this.zoom;
        this.panY = e.clientY - this.canvas.getBoundingClientRect().top - mousePos.y * this.zoom;

        this.updateZoomDisplay();
        this.render();
    }

    hitTest(pos, types = ['wall', 'door', 'window']) {
        const HIT_TOLERANCE = 10 / this.zoom;
        const data = this.controller.model.data;

        // Check doors and windows first (they are smaller, on top of walls)
        if (types.includes('door') || types.includes('window')) {
            const items = [...data.doors, ...data.windows];
            for (const item of items) {
                if (GeometryEngine.distance(pos, item.position) < HIT_TOLERANCE * 2) {
                    return item;
                }
            }
        }

        // Check walls
        if (types.includes('wall')) {
            for (const wall of data.walls) {
                const dist = GeometryEngine.distanceToSegment(pos, wall.start, wall.end);
                if (dist < HIT_TOLERANCE + wall.thickness/2) {
                    return wall;
                }
            }
        }

        // Check rooms (basic bounding box or centroid hit test)
        // Simplified: return room if within polygon
        if (types.includes('room')) {
             for (const room of data.rooms) {
                 if(this.pointInPolygon(pos, room.boundary)) {
                     return room;
                 }
             }
        }

        return null;
    }

    pointInPolygon(point, vs) {
        let x = point.x, y = point.y;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            let xi = vs[i].x, yi = vs[i].y;
            let xj = vs[j].x, yj = vs[j].y;
            let intersect = ((yi > y) != (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // --- Rendering ---

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoom, this.zoom);

        this.drawGrid();

        const data = this.controller.model.data;

        // Rooms
        for (const room of data.rooms) {
            this.drawRoom(room);
        }

        // Walls
        for (const wall of data.walls) {
            this.drawWall(wall, wall.id === this.controller.selectedElementId);
        }

        // Temp Wall
        if (this.controller.currentTool === 'wall' && this.tempWallStart && this.currentMousePos) {
            const snappedPos = GeometryEngine.snapPoint(this.currentMousePos, data.walls);
            this.ctx.beginPath();
            this.ctx.moveTo(this.tempWallStart.x, this.tempWallStart.y);
            this.ctx.lineTo(snappedPos.x, snappedPos.y);
            this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.5)';
            this.ctx.lineWidth = 10;
            this.ctx.stroke();

            // Show length
            const dist = GeometryEngine.distance(this.tempWallStart, snappedPos);
            const mDist = (dist * data.scale).toFixed(2);
            this.ctx.fillStyle = 'blue';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(`${mDist}m`, (this.tempWallStart.x + snappedPos.x)/2, (this.tempWallStart.y + snappedPos.y)/2 - 10);
        }

        // Doors & Windows
        for (const door of data.doors) {
            this.drawDoor(door, door.id === this.controller.selectedElementId);
        }
        for (const win of data.windows) {
            this.drawWindow(win, win.id === this.controller.selectedElementId);
        }

        this.ctx.restore();

        this.updateRoomsList();
    }

    drawGrid() {
        const gridSize = 50; // pixels
        const w = this.canvas.width / this.zoom;
        const h = this.canvas.height / this.zoom;

        const startX = -this.panX / this.zoom;
        const startY = -this.panY / this.zoom;

        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1 / this.zoom;

        this.ctx.beginPath();
        for (let x = Math.floor(startX / gridSize) * gridSize; x < startX + w; x += gridSize) {
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, startY + h);
        }
        for (let y = Math.floor(startY / gridSize) * gridSize; y < startY + h; y += gridSize) {
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(startX + w, y);
        }
        this.ctx.stroke();
    }

    drawWall(wall, isSelected) {
        this.ctx.beginPath();
        this.ctx.moveTo(wall.start.x, wall.start.y);
        this.ctx.lineTo(wall.end.x, wall.end.y);
        this.ctx.strokeStyle = isSelected ? '#3498db' : '#2c3e50';
        this.ctx.lineWidth = wall.thickness;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();

        // Draw length if selected
        if (isSelected) {
            const dist = GeometryEngine.distance(wall.start, wall.end);
            const mDist = (dist * this.controller.model.data.scale).toFixed(2);
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.font = `${14/this.zoom}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${mDist}m`, (wall.start.x + wall.end.x)/2, (wall.start.y + wall.end.y)/2 - wall.thickness);
        }
    }

    drawRoom(room) {
        if (!room.boundary || room.boundary.length < 3) return;

        this.ctx.beginPath();
        this.ctx.moveTo(room.boundary[0].x, room.boundary[0].y);
        for(let i=1; i<room.boundary.length; i++) {
            this.ctx.lineTo(room.boundary[i].x, room.boundary[i].y);
        }
        this.ctx.closePath();

        this.ctx.fillStyle = room.id === this.controller.selectedElementId ? 'rgba(52, 152, 219, 0.3)' : 'rgba(236, 240, 241, 0.5)';
        this.ctx.fill();

        // Calculate centroid for text
        let cx = 0, cy = 0;
        for(let p of room.boundary) { cx += p.x; cy += p.y; }
        cx /= room.boundary.length;
        cy /= room.boundary.length;

        this.ctx.fillStyle = '#333';
        this.ctx.font = `${14/this.zoom}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(room.name, cx, cy);
        this.ctx.font = `${12/this.zoom}px Arial`;
        this.ctx.fillText(`${room.area.toFixed(2)} sqm`, cx, cy + 15/this.zoom);
    }

    drawDoor(door, isSelected) {
        this.ctx.fillStyle = isSelected ? '#3498db' : '#f1c40f';
        this.ctx.beginPath();
        this.ctx.arc(door.position.x, door.position.y, door.width / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawWindow(win, isSelected) {
        this.ctx.fillStyle = isSelected ? '#3498db' : '#87ceeb';
        this.ctx.fillRect(win.position.x - win.width/2, win.position.y - 5, win.width, 10);
        this.ctx.strokeRect(win.position.x - win.width/2, win.position.y - 5, win.width, 10);
    }

    // --- UI Panels ---

    updatePropertiesPanel() {
        const panel = document.getElementById('properties-panel');
        if (!this.controller.selectedElementId) {
            panel.innerHTML = '<p class="placeholder-text">Select an element to view properties</p>';
            return;
        }

        const el = this.controller.model.getElementById(this.controller.selectedElementId);
        if (!el) return;

        panel.innerHTML = '';

        const typeEl = document.createElement('strong');
        typeEl.textContent = 'Type: ';
        panel.appendChild(typeEl);
        panel.appendChild(document.createTextNode(el.type));
        panel.appendChild(document.createElement('br'));

        const idEl = document.createElement('strong');
        idEl.textContent = 'ID: ';
        panel.appendChild(idEl);
        panel.appendChild(document.createTextNode(el.id));
        panel.appendChild(document.createElement('br'));
        panel.appendChild(document.createElement('br'));

        if (el.type === 'room') {
            const row1 = document.createElement('div');
            row1.className = 'property-row';
            const label1 = document.createElement('label');
            label1.textContent = 'Name';
            const input1 = document.createElement('input');
            input1.type = 'text';
            input1.id = 'prop-room-name';
            input1.value = el.name;
            row1.appendChild(label1);
            row1.appendChild(input1);
            panel.appendChild(row1);

            const row2 = document.createElement('div');
            row2.className = 'property-row';
            const label2 = document.createElement('label');
            label2.textContent = 'Type';
            const input2 = document.createElement('input');
            input2.type = 'text';
            input2.id = 'prop-room-type';
            input2.value = el.type;
            row2.appendChild(label2);
            row2.appendChild(input2);
            panel.appendChild(row2);

            const areaP = document.createElement('p');
            const areaStrong = document.createElement('strong');
            areaStrong.textContent = 'Area: ';
            areaP.appendChild(areaStrong);
            areaP.appendChild(document.createTextNode(`${el.area.toFixed(2)} sqm`));
            panel.appendChild(areaP);

            // Bind inputs
            input1.addEventListener('change', (e) => {
                this.controller.model.updateRoom(el.id, { name: e.target.value });
                this.controller.saveState();
            });
            input2.addEventListener('change', (e) => {
                this.controller.model.updateRoom(el.id, { type: e.target.value });
                this.controller.saveState();
            });
        } else if (el.type === 'wall') {
            const length = (GeometryEngine.distance(el.start, el.end) * this.controller.model.data.scale).toFixed(2);
            const lengthP = document.createElement('p');
            const lengthStrong = document.createElement('strong');
            lengthStrong.textContent = 'Length: ';
            lengthP.appendChild(lengthStrong);
            lengthP.appendChild(document.createTextNode(`${length} m`));
            panel.appendChild(lengthP);
        }
    }

    updateRoomsList() {
        const list = document.getElementById('rooms-list');
        const rooms = this.controller.model.data.rooms;

        list.innerHTML = '';

        if (rooms.length === 0) {
            list.innerHTML = '<p class="placeholder-text">No rooms detected</p>';
            return;
        }

        rooms.forEach(room => {
            const roomDiv = document.createElement('div');
            roomDiv.className = 'room-item';
            roomDiv.style.cursor = 'pointer';

            const nameStrong = document.createElement('strong');
            nameStrong.textContent = room.name;
            roomDiv.appendChild(nameStrong);
            roomDiv.appendChild(document.createElement('br'));

            roomDiv.appendChild(document.createTextNode(`Area: ${room.area.toFixed(2)} sqm`));

            roomDiv.addEventListener('click', () => {
                this.controller.selectElement(room.id);
                this.controller.setTool('select');
                this.render();
            });

            list.appendChild(roomDiv);
        });
    }
}