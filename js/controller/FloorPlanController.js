class FloorPlanController extends EventEmitter {
    constructor(model) {
        super();
        this.model = model;

        // State
        this.currentTool = 'select';
        this.selectedElementId = null;
        this.scale = 0.01;

        // Undo/Redo stack
        this.history = [];
        this.historyIndex = -1;

        this.saveState();

        // Listen for model changes to update rooms and save history
        this.model.on('change', () => {
            this.updateRooms();
            this.emit('model_changed');
        });
    }

    setTool(toolName) {
        this.currentTool = toolName;
        this.selectedElementId = null;
        this.emit('tool_changed', toolName);
    }

    selectElement(id) {
        this.selectedElementId = id;
        this.emit('selection_changed', id);
    }

    setScale(scale) {
        this.scale = scale;
        this.model.data.scale = scale;
        this.emit('scale_changed', scale);
        this.updateRooms(); // Recompute areas based on new scale
    }

    // --- Actions ---

    addWall(start, end) {
        this.model.addWall(start, end);
        this.saveState();
    }

    updateWallEnd(id, newEnd) {
        this.model.updateWall(id, { end: newEnd });
        // Don't save state on every mouse move, only on mouse up (handled by UI)
    }

    commitAction() {
        this.saveState();
    }

    deleteSelected() {
        if (this.selectedElementId) {
            this.model.removeElement(this.selectedElementId);
            this.selectedElementId = null;
            this.emit('selection_changed', null);
            this.saveState();
        }
    }

    addDoorToWall(wallId, position) {
        this.model.addDoor(wallId, position);
        this.saveState();
    }

    addWindowToWall(wallId, position) {
        this.model.addWindow(wallId, position);
        this.saveState();
    }

    updateRooms() {
        // Only run this if we aren't in the middle of a continuous action
        // For simplicity, we just run it on model change.
        if (this.model.data.walls.length === 0) {
            if (this.model.data.rooms.length > 0) {
                this.model.data.rooms = [];
            }
            return;
        }

        const faces = GeometryEngine.detectRooms(this.model.data.walls);

        // Calculate real-world area
        const roomsData = faces.map(face => ({
            boundary: face.boundary,
            area: face.area * Math.pow(this.model.data.scale, 2)
        }));

        // Prevent infinite loop by checking if rooms actually changed
        // For now, we do a simple check: if length differs or areas differ significantly
        let changed = this.model.data.rooms.length !== roomsData.length;
        if (!changed) {
             for(let i=0; i<roomsData.length; i++) {
                 if (Math.abs(this.model.data.rooms[i].area - roomsData[i].area) > 0.01) {
                     changed = true; break;
                 }
             }
        }

        if (changed) {
            // We temporarily suspend history recording here to avoid infinite loops,
            // but we want room changes to be part of the current state.
            // Actually, model.setRooms triggers 'change'.
            // We'll update model data directly without triggering a full history save,
            // or we do it carefully.
            this.model.data.rooms = roomsData.map((r, index) => {
                const existingRoom = this.model.data.rooms.find(er => this.model.areRoomsEqual(er.boundary, r.boundary));
                return {
                    id: existingRoom ? existingRoom.id : this.model.generateId('room'),
                    type: existingRoom ? existingRoom.type : 'room',
                    name: existingRoom ? existingRoom.name : `Room ${index + 1}`,
                    area: r.area,
                    boundary: r.boundary
                };
            });
        }
    }

    // --- History (Undo/Redo) ---

    saveState() {
        const state = this.model.cloneData();

        // If we are not at the end of history, truncate the future
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push(state);
        this.historyIndex++;

        this.emit('history_changed', {
            canUndo: this.historyIndex > 0,
            canRedo: this.historyIndex < this.history.length - 1
        });
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.model.data = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.selectedElementId = null;
            this.emit('selection_changed', null);
            this.emit('model_changed');
            this.emit('history_changed', {
                canUndo: this.historyIndex > 0,
                canRedo: this.historyIndex < this.history.length - 1
            });
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.model.data = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.selectedElementId = null;
            this.emit('selection_changed', null);
            this.emit('model_changed');
            this.emit('history_changed', {
                canUndo: this.historyIndex > 0,
                canRedo: this.historyIndex < this.history.length - 1
            });
        }
    }

    // --- Storage ---

    saveLocal() {
        const json = this.model.toJSON();
        localStorage.setItem('dtech_floorplan', json);
        return true;
    }

    loadLocal() {
        const json = localStorage.getItem('dtech_floorplan');
        if (json) {
            const success = this.model.load(json);
            if (success) {
                this.history = [];
                this.historyIndex = -1;
                this.saveState();
                return true;
            }
        }
        return false;
    }

    exportJSON() {
        const json = this.model.toJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.model.data.name || 'floorplan'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}