class CanvasUI {
    constructor(controller, canvasId) {
        this.controller = controller;
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.container = this.canvas.parentElement;
        this.renderer = new CanvasRenderer(this.ctx, this.canvas, this.controller.model);

        // Viewport state
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;

        // Interaction state
        this.isDragging = false;
        this.isPanning = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Touch interaction specifics
        this.lastPinchDist = null;
        this.lastTouchCenter = null;
        this.touchTapTimeout = null;

        // Drawing state
        this.tempWallStart = null;
        this.currentMousePos = null;
        this.snapPoint = null;
        this.activeHandle = null;

        this.initCanvas();
        this.bindEvents();
        this.bindDOM();
        this.render();
    }

    initCanvas() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
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
        let clientX = e.clientX;
        let clientY = e.clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }

        const x = clientX - rect.left;
        const y = clientY - rect.top;
        return {
            x: (x - this.panX) / this.zoom,
            y: (y - this.panY) / this.zoom
        };
    }

    bindEvents() {
        // Mouse Events
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

        // Touch Events
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
        this.canvas.addEventListener('touchcancel', this.onTouchEnd.bind(this));

        this.controller.on('model_changed', () => this.render());
        this.controller.on('selection_changed', () => this.updatePropertiesPanel());
        this.controller.on('tool_changed', (tool) => {
            this.tempWallStart = null;
            this.currentMousePos = null;
            this.snapPoint = null;
            if(tool === 'measurement') {
                this.controller.measurementEngine.active = false;
            }
            this.render();

            // UI Palette toggles
            const palette = document.getElementById('object-palette');
            if(tool === 'object') {
                palette.classList.remove('hidden');
            } else {
                palette.classList.add('hidden');
            }
        });
    }

    bindDOM() {
        // Tools
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const btnEl = e.currentTarget;
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btnEl.classList.add('active');

                const tool = btnEl.dataset.tool;
                if (tool === 'delete') {
                    this.controller.deleteSelected();
                    setTimeout(() => {
                        document.querySelector('[data-tool="select"]').click();
                    }, 100);
                } else if (tool === 'label') {
                    this.controller.setTool('label');
                    const text = prompt("Enter label text:");
                    if (text && this.currentMousePos) {
                        this.controller.model.addLabel(text, this.currentMousePos);
                        this.controller.commitAction();
                    }
                    setTimeout(() => document.querySelector('[data-tool="select"]').click(), 100);
                } else {
                    this.controller.setTool(tool);
                }
            });
        });

        // Global Toolbar
        document.getElementById('btn-new').addEventListener('click', () => {
            if(confirm("Create new plan? Unsaved changes will be lost.")) {
                this.controller.model.reset();
                this.controller.historyEngine.clear();
                this.controller.historyEngine.saveState(this.controller.model.data);
                this.panX = this.canvas.width / 2;
                this.panY = this.canvas.height / 2;
                this.zoom = 1;
                this.updateZoomDisplay();
            }
        });

        document.getElementById('btn-save').addEventListener('click', () => {
            if (this.controller.saveLocal()) {
                this.showStatus("Saved to local storage");
            }
        });

        document.getElementById('btn-load').addEventListener('click', () => {
            if (this.controller.loadLocal()) {
                this.showStatus("Loaded from local storage");
                this.render(); // force render
            }
        });

        document.getElementById('btn-export-json').addEventListener('click', () => {
            this.controller.exportJSON();
        });

        document.getElementById('btn-export-pdf').addEventListener('click', () => {
             if (window.PDFExporter) {
                 window.PDFExporter.export(this.controller.model, this.canvas);
             } else {
                 alert("PDF Exporter not available.");
             }
        });

        // Import JSON
        const btnImport = document.getElementById('btn-import');
        if(btnImport) {
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
                            this.controller.historyEngine.clear();
                            this.controller.historyEngine.saveState(this.controller.model.data);
                            this.render();
                        }
                    };
                    reader.readAsText(file);
                };
                input.click();
            });
        }

        // Undo / Redo
        const btnUndo = document.getElementById('btn-undo');
        const btnRedo = document.getElementById('btn-redo');

        btnUndo.addEventListener('click', () => this.controller.undo());
        btnRedo.addEventListener('click', () => this.controller.redo());

        this.controller.historyEngine.on('history_changed', ({canUndo, canRedo}) => {
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
        const fitBtn = document.getElementById('btn-zoom-fit');
        if(fitBtn) {
            fitBtn.addEventListener('click', () => {
                const data = this.controller.model.data;
                if(data.walls.length === 0) return;

                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                data.walls.forEach(w => {
                    minX = Math.min(minX, w.start.x, w.end.x);
                    minY = Math.min(minY, w.start.y, w.end.y);
                    maxX = Math.max(maxX, w.start.x, w.end.x);
                    maxY = Math.max(maxY, w.start.y, w.end.y);
                });

                const fpWidth = maxX - minX;
                const fpHeight = maxY - minY;

                const padding = 100; // pixels
                const scaleX = (this.canvas.width - padding) / fpWidth;
                const scaleY = (this.canvas.height - padding) / fpHeight;

                this.zoom = Math.min(scaleX, scaleY);
                this.zoom = Math.max(0.1, Math.min(5, this.zoom));

                const cx = minX + fpWidth/2;
                const cy = minY + fpHeight/2;

                this.panX = this.canvas.width/2 - cx * this.zoom;
                this.panY = this.canvas.height/2 - cy * this.zoom;

                this.updateZoomDisplay();
                this.render();
            });
        }

        // Settings
        document.getElementById('input-scale').addEventListener('change', (e) => {
            const val = parseFloat(e.target.value);
            // Pixels per meter to internal scale (meters per pixel)
            const internalScale = 1 / val;
            this.controller.setScale(internalScale);
            document.getElementById('scale-value-display').innerText = val;
            this.render();
        });

        // Initialize scale display correctly
        const currentScale = this.controller.model.data.scale;
        const ppm = Math.round(1 / currentScale);
        document.getElementById('input-scale').value = ppm;
        document.getElementById('scale-value-display').innerText = ppm;

        document.getElementById('input-grid-size').addEventListener('change', (e) => {
            this.controller.snapEngine.setGridSize(parseInt(e.target.value));
            this.render();
        });

        // Mobile menu
        const mobileMenu = document.getElementById('btn-mobile-menu');
        if(mobileMenu) {
            mobileMenu.addEventListener('click', () => {
                document.getElementById('sidebar-left').classList.toggle('mobile-hidden');
            });
        }

        this.populateObjectPalette();
    }

    showStatus(msg) {
        const sb = document.getElementById('status-bar');
        sb.innerText = msg;
        setTimeout(() => sb.innerText = "Ready", 3000);
    }

    populateObjectPalette() {
        const catSelect = document.getElementById('object-category-select');
        const objList = document.getElementById('object-list');
        const categories = ObjectManager.getCategories();

        const renderList = (cat) => {
            objList.innerHTML = '';
            if(!categories[cat]) return;
            categories[cat].forEach(obj => {
                const div = document.createElement('div');
                div.className = 'object-item';
                div.innerText = obj.name;
                div.onclick = () => {
                    document.querySelectorAll('.object-item').forEach(el => el.classList.remove('selected'));
                    div.classList.add('selected');
                    this.controller.currentObjectType = obj.id;
                };
                objList.appendChild(div);
            });
            if(objList.firstChild) objList.firstChild.click();
        };

        catSelect.addEventListener('change', (e) => renderList(e.target.value));
        renderList(catSelect.value);
    }

    setZoom(newZoom, mouseX, mouseY) {
        if(mouseX === undefined) mouseX = this.canvas.width/2;
        if(mouseY === undefined) mouseY = this.canvas.height/2;

        // Mouse pos before zoom
        const x = (mouseX - this.panX) / this.zoom;
        const y = (mouseY - this.panY) / this.zoom;

        this.zoom = Math.max(0.1, Math.min(5, newZoom));

        this.panX = mouseX - x * this.zoom;
        this.panY = mouseY - y * this.zoom;

        this.updateZoomDisplay();
        this.render();
    }

    updateZoomDisplay() {
        const zl = document.getElementById('zoom-level');
        if(zl) zl.innerText = `${Math.round(this.zoom * 100)}%`;
    }

    // --- Interaction Core ---

    handleInputStart(pos, rawX, rawY, isMiddleClick) {
        if (isMiddleClick || this.controller.currentTool === 'pan') {
            this.isPanning = true;
            this.lastMouseX = rawX;
            this.lastMouseY = rawY;
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        const useGrid = document.getElementById('check-snap-grid')?.checked;
        const snappedPos = this.controller.snapEngine.snapPoint(pos, this.controller.model.data.walls, useGrid, null, this.zoom);

        if (this.controller.currentTool === 'select') {
            // Check handles first
            this.activeHandle = this.hitTestHandle(pos);
            if(this.activeHandle) {
                this.isDragging = true;
                this.controller.selectElement(this.activeHandle.wallId);
                return;
            }

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
                let finalPos = snappedPos;
                if(document.getElementById('check-snap-angle')?.checked) {
                    finalPos = this.controller.snapEngine.snapAngle(this.tempWallStart, finalPos);
                }
                this.controller.addWall(this.tempWallStart, finalPos);
                this.tempWallStart = finalPos; // Continuous drawing
            }
        }
        else if (this.controller.currentTool === 'door' || this.controller.currentTool === 'window') {
            const hit = this.hitTest(pos, ['wall']);
            if (hit) {
                const projected = GeometryEngine.projectPointOnLine(pos, hit.start, hit.end);

                // Calculate rotation based on wall angle
                const dx = hit.end.x - hit.start.x;
                const dy = hit.end.y - hit.start.y;
                let angle = Math.atan2(dy, dx);

                if (this.controller.currentTool === 'door') {
                    this.controller.model.addDoor(hit.id, projected, 80, angle, false);
                } else {
                    this.controller.model.addWindow(hit.id, projected, 100, angle);
                }
                this.controller.commitAction();
            }
        }
        else if (this.controller.currentTool === 'object') {
            if(this.controller.currentObjectType) {
                const size = ObjectManager.getDefaultSize(this.controller.currentObjectType);
                let rotation = 0;
                // Auto-align object to nearby wall
                const hit = this.hitTest(pos, ['wall']);
                if (hit) {
                    const wallDx = hit.end.x - hit.start.x;
                    const wallDy = hit.end.y - hit.start.y;
                    rotation = Math.atan2(wallDy, wallDx);
                }
                this.controller.model.addObject(this.controller.currentObjectType, snappedPos, size, rotation);
                this.controller.commitAction();
                // Revert to select
                document.querySelector('[data-tool="select"]').click();
            }
        }
        else if (this.controller.currentTool === 'measurement') {
            const mEngine = this.controller.measurementEngine;
            if(!mEngine.active) {
                mEngine.startMeasurement(snappedPos);
            } else {
                const res = mEngine.endMeasurement();
                this.showStatus(`Measurement: ${(GeometryEngine.distance(res.start, res.end) * this.controller.model.data.scale).toFixed(2)}m`);
                document.querySelector('[data-tool="select"]').click();
            }
        }
    }

    handleInputMove(pos, rawX, rawY) {
        if (this.isPanning) {
            const dx = rawX - this.lastMouseX;
            const dy = rawY - this.lastMouseY;
            this.panX += dx;
            this.panY += dy;
            this.lastMouseX = rawX;
            this.lastMouseY = rawY;
            this.render();
            return;
        }

        this.currentMousePos = pos;
        document.getElementById('coordinates').innerText = `X: ${Math.round(pos.x)}, Y: ${Math.round(pos.y)}`;

        const useGrid = document.getElementById('check-snap-grid')?.checked;
        const useAngle = document.getElementById('check-snap-angle')?.checked;

        let ignoreWallId = null;
        if(this.activeHandle) ignoreWallId = this.activeHandle.wallId;
        else if (this.isDragging) ignoreWallId = this.controller.selectedElementId;

        this.snapPoint = this.controller.snapEngine.snapPoint(pos, this.controller.model.data.walls, useGrid, ignoreWallId, this.zoom);

        if (this.activeHandle && this.controller.selectedElementId) {
            let finalPos = this.snapPoint;

            const el = this.controller.model.getElementById(this.controller.selectedElementId);
            if(useAngle && el) {
                // If moving start, angle from end to start. If moving end, angle from start to end.
                if(this.activeHandle.type === 'start') {
                    finalPos = this.controller.snapEngine.snapAngle(el.end, finalPos);
                } else {
                    finalPos = this.controller.snapEngine.snapAngle(el.start, finalPos);
                }
            }

            if (this.activeHandle.type === 'start') {
                this.controller.updateWallEnd(el.id, { start: finalPos, end: el.end });
            } else {
                this.controller.updateWallEnd(el.id, { start: el.start, end: finalPos });
            }
            this.render();
            return;
        }

        if (this.isDragging && this.controller.selectedElementId) {
            const dx = pos.x - this.lastMouseX;
            const dy = pos.y - this.lastMouseY;

            const el = this.controller.model.getElementById(this.controller.selectedElementId);
            if (el && el.type === 'wall') {
                this.controller.updateWallEnd(el.id, {
                    start: { x: el.start.x + dx, y: el.start.y + dy },
                    end: { x: el.end.x + dx, y: el.end.y + dy }
                });
            } else if (el && (el.type === 'door' || el.type === 'window' || el.type === 'object' || el.type === 'label')) {
                // Moving objects
                el.position.x += dx;
                el.position.y += dy;

                // Snap door/window to wall if nearby
                if(el.type === 'door' || el.type === 'window') {
                    const HIT_TOLERANCE_DRAG = 40 / this.zoom;
                    let closestWall = null;
                    let minDist = HIT_TOLERANCE_DRAG;
                    for (const wall of this.controller.model.data.walls) {
                        const dist = GeometryEngine.distanceToSegment(pos, wall.start, wall.end);
                        if (dist < minDist) {
                            minDist = dist;
                            closestWall = wall;
                        }
                    }
                    if(closestWall) {
                        const projected = GeometryEngine.projectPointOnLine(pos, closestWall.start, closestWall.end);
                        el.position = projected;
                        el.wallId = closestWall.id;
                        const wallDx = closestWall.end.x - closestWall.start.x;
                        const wallDy = closestWall.end.y - closestWall.start.y;
                        el.rotation = Math.atan2(wallDy, wallDx);
                    }
                } else if (el.type === 'object') {
                    // Soft-snap furniture rotation to walls when dragging
                    const hit = this.hitTest(pos, ['wall']);
                    if(hit) {
                        const wallDx = hit.end.x - hit.start.x;
                        const wallDy = hit.end.y - hit.start.y;
                        el.rotation = Math.atan2(wallDy, wallDx);
                    }
                }

                this.controller.model.emit('change');
            }

            this.lastMouseX = pos.x;
            this.lastMouseY = pos.y;
        }

        if (this.controller.currentTool === 'wall' && this.tempWallStart) {
            if(useAngle) {
                this.snapPoint = this.controller.snapEngine.snapAngle(this.tempWallStart, this.snapPoint);
                this.currentMousePos = this.snapPoint;
            }
        }

        if (this.controller.currentTool === 'measurement' && this.controller.measurementEngine.active) {
            this.controller.measurementEngine.updateMeasurement(this.snapPoint);
        }

        // Re-render for temp walls, snapping, dragging
        if(this.controller.currentTool === 'wall' || this.controller.currentTool === 'measurement' || this.isDragging || this.activeHandle || this.snapPoint) {
            this.render();
        }
    }

    handleInputEnd() {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'crosshair';
        }

        if (this.isDragging || this.activeHandle) {
            this.isDragging = false;
            this.activeHandle = null;
            this.controller.commitAction(); // Save state after drag/resize ends
        }
    }

    // --- Mouse Events ---

    onMouseDown(e) {
        if (e.button !== 0 && e.button !== 1) return;
        const pos = this.getMousePos(e);
        const isMiddleClick = e.button === 1 || (e.button === 0 && e.altKey);
        this.handleInputStart(pos, e.clientX, e.clientY, isMiddleClick);
    }

    onMouseMove(e) {
        const pos = this.getMousePos(e);
        this.handleInputMove(pos, e.clientX, e.clientY);
    }

    onMouseUp(e) {
        this.handleInputEnd();
        // Right click cancels wall drawing
        if (e.button === 2) {
            if(this.controller.currentTool === 'wall') {
                this.tempWallStart = null;
                this.render();
            } else if (this.controller.currentTool === 'measurement') {
                this.controller.measurementEngine.active = false;
                this.render();
            }
        }
    }

    onWheel(e) {
        e.preventDefault();
        const mousePos = this.getMousePos(e);
        const zoomFactor = 1.1;

        let newZoom = this.zoom;
        if (e.deltaY < 0) {
            newZoom *= zoomFactor;
        } else {
            newZoom /= zoomFactor;
        }

        this.setZoom(newZoom, e.clientX - this.canvas.getBoundingClientRect().left, e.clientY - this.canvas.getBoundingClientRect().top);
    }

    // --- Touch Events ---

    onTouchStart(e) {
        e.preventDefault();
        const touches = e.touches;

        if (touches.length === 1) {
            const pos = this.getMousePos(e);
            // Simulate middle click panning if panning tool is active or 2 fingers (handled below)
            this.handleInputStart(pos, touches[0].clientX, touches[0].clientY, false);
        } else if (touches.length === 2) {
            // Pinch to zoom / Pan
            this.isPanning = true;
            this.isDragging = false;
            this.activeHandle = null;

            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            this.lastPinchDist = Math.sqrt(dx*dx + dy*dy);

            this.lastTouchCenter = {
                x: (touches[0].clientX + touches[1].clientX) / 2,
                y: (touches[0].clientY + touches[1].clientY) / 2
            };
            this.lastMouseX = this.lastTouchCenter.x;
            this.lastMouseY = this.lastTouchCenter.y;
        }
    }

    onTouchMove(e) {
        e.preventDefault();
        const touches = e.touches;

        if (touches.length === 1 && !this.isPanning) {
            const pos = this.getMousePos(e);
            this.handleInputMove(pos, touches[0].clientX, touches[0].clientY);
        } else if (touches.length === 2) {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            const dist = Math.sqrt(dx*dx + dy*dy);

            const center = {
                x: (touches[0].clientX + touches[1].clientX) / 2,
                y: (touches[0].clientY + touches[1].clientY) / 2
            };

            // Pan
            const panDx = center.x - this.lastMouseX;
            const panDy = center.y - this.lastMouseY;
            this.panX += panDx;
            this.panY += panDy;
            this.lastMouseX = center.x;
            this.lastMouseY = center.y;

            // Zoom
            if (this.lastPinchDist) {
                const zoomDelta = dist / this.lastPinchDist;
                const newZoom = this.zoom * zoomDelta;
                // Calculate mouse pos relative to canvas
                const rect = this.canvas.getBoundingClientRect();
                this.setZoom(newZoom, center.x - rect.left, center.y - rect.top);
            }
            this.lastPinchDist = dist;
        }
    }

    onTouchEnd(e) {
        e.preventDefault();
        this.handleInputEnd();
        this.lastPinchDist = null;
        this.lastTouchCenter = null;

        if (e.touches.length === 0 && this.isPanning) {
            this.isPanning = false;
        }
    }

    // --- Hit Testing ---

    hitTestHandle(pos) {
        const HIT_TOLERANCE = 25 / this.zoom;
        const elId = this.controller.selectedElementId;
        if(!elId) return null;

        const el = this.controller.model.getElementById(elId);
        if(el && el.type === 'wall') {
            if (GeometryEngine.distance(pos, el.start) < HIT_TOLERANCE) {
                return { wallId: el.id, type: 'start' };
            }
            if (GeometryEngine.distance(pos, el.end) < HIT_TOLERANCE) {
                return { wallId: el.id, type: 'end' };
            }
        }
        return null;
    }

    hitTest(pos, types = ['door', 'window', 'object', 'label', 'wall', 'room']) {
        const HIT_TOLERANCE = 25 / this.zoom;
        const data = this.controller.model.data;

        for (const type of types) {
            if (type === 'door' || type === 'window' || type === 'object') {
                const items = type === 'object' ? (data.objects || []) : (type === 'door' ? data.doors : data.windows);
                for (const item of items) {
                    if (GeometryEngine.distance(pos, item.position) < HIT_TOLERANCE * 2) {
                        return item;
                    }
                }
            }

            if (type === 'label' && data.labels) {
                for (const lbl of data.labels) {
                     if (GeometryEngine.distance(pos, lbl.position) < HIT_TOLERANCE * 2) {
                        return lbl;
                    }
                }
            }

            if (type === 'wall') {
                for (const wall of data.walls) {
                    const dist = GeometryEngine.distanceToSegment(pos, wall.start, wall.end);
                    if (dist < HIT_TOLERANCE + wall.thickness/2) {
                        return wall;
                    }
                }
            }

            if (type === 'room') {
                 for (const room of data.rooms) {
                     if(this.pointInPolygon(pos, room.boundary)) {
                         return room;
                     }
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

    // --- Rendering Wrapper ---
    render() {
        const state = {
            panX: this.panX,
            panY: this.panY,
            zoom: this.zoom,
            currentTool: this.controller.currentTool,
            tempWallStart: this.tempWallStart,
            currentMousePos: this.currentMousePos,
            selectedElementId: this.controller.selectedElementId,
            measurement: this.controller.measurementEngine,
            snapPoint: this.snapPoint
        };
        this.renderer.render(state);
        this.updateRoomsList();
    }

    // --- UI Panels ---

    updatePropertiesPanel() {
        const panel = document.getElementById('properties-panel');
        if (!this.controller.selectedElementId) {
            panel.innerHTML = '<p class="placeholder-text">Select an element to view properties</p>';
            return;
        }

        const el = this.controller.model.getElementById(this.controller.selectedElementId);
        if (!el) {
             panel.innerHTML = '<p class="placeholder-text">Select an element to view properties</p>';
             return;
        }

        panel.innerHTML = '';

        const typeInfo = document.createElement('div');
        typeInfo.className = 'property-info';
        typeInfo.innerHTML = `<strong>${el.type.toUpperCase()}</strong><br><small>ID: ${el.id}</small>`;
        panel.appendChild(typeInfo);

        if (el.type === 'room') {
            this.createInputRow(panel, 'Name', el.name, (val) => this.updateProp(el.id, {name: val}));
            this.createInputRow(panel, 'Type', el.type, null, true); // readonly
            this.createInputRow(panel, 'Area (m²)', el.area.toFixed(2), null, true);
        } else if (el.type === 'wall') {
            const length = (GeometryEngine.distance(el.start, el.end) * this.controller.model.data.scale).toFixed(2);
            this.createInputRow(panel, 'Length (m)', length, null, true);
            this.createInputRow(panel, 'Thickness', el.thickness, (val) => this.updateProp(el.id, {thickness: parseFloat(val)}), false, 'number');
        } else if (el.type === 'door') {
            this.createInputRow(panel, 'Width', el.width, (val) => this.updateProp(el.id, {width: parseFloat(val)}), false, 'number');

            const flipBtn = document.createElement('button');
            flipBtn.innerText = "Flip Direction";
            flipBtn.onclick = () => {
                this.updateProp(el.id, {flip: !el.flip});
            };
            panel.appendChild(flipBtn);
        } else if (el.type === 'window' || el.type === 'object') {
            this.createInputRow(panel, 'Width', el.width, (val) => this.updateProp(el.id, {width: parseFloat(val)}), false, 'number');
            if(el.height) {
                this.createInputRow(panel, 'Height', el.height, (val) => this.updateProp(el.id, {height: parseFloat(val)}), false, 'number');
            }
            this.createInputRow(panel, 'Rotation (deg)', (el.rotation * 180 / Math.PI).toFixed(0), (val) => {
                this.updateProp(el.id, {rotation: parseFloat(val) * Math.PI / 180});
            }, false, 'number');
        } else if (el.type === 'label') {
            this.createInputRow(panel, 'Text', el.text, (val) => this.updateProp(el.id, {text: val}));
            this.createInputRow(panel, 'Font Size', el.fontSize, (val) => this.updateProp(el.id, {fontSize: parseInt(val)}), false, 'number');
        }
    }

    createInputRow(panel, labelText, value, onChange, readonly = false, type = 'text') {
        const row = document.createElement('div');
        row.className = 'property-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = type;
        input.value = value;
        if(readonly) {
            input.disabled = true;
            input.style.backgroundColor = '#f8f9fa';
        } else if (onChange) {
            input.addEventListener('change', (e) => onChange(e.target.value));
        }
        row.appendChild(label);
        row.appendChild(input);
        panel.appendChild(row);
    }

    updateProp(id, updates) {
        this.controller.model.updateElement(id, updates);
        this.controller.commitAction();
        this.render();
    }

    updateRoomsList() {
        const list = document.getElementById('rooms-list');
        const rooms = this.controller.model.data.rooms;

        if(!list) return;

        list.innerHTML = '';

        if (rooms.length === 0) {
            list.innerHTML = '<p class="placeholder-text">No rooms detected</p>';
            return;
        }

        rooms.forEach(room => {
            const roomDiv = document.createElement('div');
            roomDiv.className = 'room-item';
            if(room.id === this.controller.selectedElementId) {
                roomDiv.classList.add('selected');
                roomDiv.style.borderColor = 'var(--accent-color)';
                roomDiv.style.backgroundColor = '#ebf5fb';
            }

            roomDiv.innerHTML = `<strong>${room.name}</strong><small>${room.area.toFixed(2)} m²</small>`;

            roomDiv.addEventListener('click', () => {
                this.controller.selectElement(room.id);
                document.querySelector('[data-tool="select"]').click();
                this.render();
            });

            list.appendChild(roomDiv);
        });
    }
}