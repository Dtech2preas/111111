class FloorPlanController extends EventEmitter {
    constructor(model) {
        super();
        this.model = model;

        // Managers and Engines
        this.historyEngine = new HistoryEngine();
        this.snapEngine = new SnapEngine();
        this.measurementEngine = new MeasurementEngine();

        // State
        this.currentTool = 'select';
        this.selectedElementId = null;
        this.currentObjectType = null; // For furniture tool

        this.historyEngine.saveState(this.model.data);

        // Listen for model changes to update rooms and save history
        this.model.on('change', () => {
            this.updateRooms();
            this.emit('model_changed');
        });

        this.historyEngine.on('history_changed', (state) => {
            this.emit('history_changed', state);
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
        this.model.data.scale = scale;
        this.emit('scale_changed', scale);
        this.updateRooms(); // Recompute areas based on new scale
    }

    // --- Actions ---

    addWall(start, end) {
        this.model.addWall(start, end);
        this.commitAction();
    }

    updateWallEnd(id, updates) {
        this.model.updateWall(id, updates);
        // Don't commitAction here, handled on mouse up
    }

    commitAction() {
        this.historyEngine.saveState(this.model.data);
    }

    deleteSelected() {
        if (this.selectedElementId) {
            this.model.removeElement(this.selectedElementId);
            this.selectedElementId = null;
            this.emit('selection_changed', null);
            this.commitAction();
        }
    }

    updateRooms() {
        const faces = RoomDetection.detect(this.model.data.walls);

        // Calculate real-world area
        const roomsData = faces.map(face => ({
            boundary: face.boundary,
            area: face.area * Math.pow(this.model.data.scale, 2)
        }));

        let changed = this.model.data.rooms.length !== roomsData.length;
        if (!changed) {
             for(let i=0; i<roomsData.length; i++) {
                 if (Math.abs(this.model.data.rooms[i].area - roomsData[i].area) > 0.01) {
                     changed = true; break;
                 }
             }
        }

        if (changed) {
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

        // Update objects room assignment
        if (this.model.data.objects) {
            this.model.data.objects.forEach(obj => {
                let foundRoom = null;
                for (const room of this.model.data.rooms) {
                    if (GeometryEngine.pointInPolygon(obj.position, room.boundary)) {
                        foundRoom = room.name; // Use name for easy UI display
                        break;
                    }
                }
                obj.roomName = foundRoom || "None";
            });
        }
    }


    // --- History Proxy ---
    undo() {
        const state = this.historyEngine.undo();
        if(state) {
            this.model.data = state;
            this.selectedElementId = null;
            this.emit('selection_changed', null);
            this.emit('model_changed');
        }
    }

    redo() {
        const state = this.historyEngine.redo();
        if(state) {
            this.model.data = state;
            this.selectedElementId = null;
            this.emit('selection_changed', null);
            this.emit('model_changed');
        }
    }

    // --- Storage ---
    saveLocal() {
        return StorageManager.saveLocal(this.model.toJSON());
    }

    loadLocal() {
        const json = StorageManager.loadLocal();
        if (json) {
            const success = this.model.load(json);
            if (success) {
                this.historyEngine.clear();
                this.historyEngine.saveState(this.model.data);
                return true;
            }
        }
        return false;
    }

    exportJSON() {
        StorageManager.exportJSON(this.model.toJSON(), this.model.data.name || 'floorplan');
    }
}